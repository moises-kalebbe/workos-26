import { sql, ensureDatabaseConnection } from "@/lib/db";
import { getValidAccessToken, googleJson } from "@/lib/googleCalendar";
import { getBalance, getMoneyBoxes, getRecentPayments, extractCofrinhos, isConfigured as mpConfigured } from "@/integrations/mercadopago/client";
import { sendPix as interSendPix, isConfigured as interConfigured } from "@/integrations/inter/client";

const WEATHER_CODES: Record<number, { day: string; night: string }> = {
  0: { day: "Ensolarado", night: "Céu limpo" },
  1: { day: "Quase limpo", night: "Poucas nuvens" },
  2: { day: "Parcialmente nublado", night: "Parcialmente nublado" },
  3: { day: "Nublado", night: "Nublado" },
  45: { day: "Neblina", night: "Neblina" },
  48: { day: "Neblina intensa", night: "Neblina intensa" },
  51: { day: "Garoa leve", night: "Garoa leve" },
  53: { day: "Garoa", night: "Garoa" },
  55: { day: "Garoa forte", night: "Garoa forte" },
  61: { day: "Chuva fraca", night: "Chuva fraca" },
  63: { day: "Chuva", night: "Chuva" },
  65: { day: "Chuva forte", night: "Chuva forte" },
  80: { day: "Pancadas leves", night: "Pancadas leves" },
  81: { day: "Pancadas de chuva", night: "Pancadas de chuva" },
  82: { day: "Pancadas fortes", night: "Pancadas fortes" },
  95: { day: "Trovoadas", night: "Trovoadas" },
  96: { day: "Trovoadas com granizo", night: "Trovoadas com granizo" },
  99: { day: "Tempestade com granizo", night: "Tempestade com granizo" },
};

const WEATHER_EMOJIS: Record<number, string> = {
  0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
  45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌧",
  61: "🌧", 63: "🌧", 65: "🌧",
  80: "🌦", 81: "🌧", 82: "⛈",
  95: "⛈", 96: "⛈", 99: "⛈",
};

export type ParsedCommand = {
  command: string;
  args: string[];
};

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

function parseMeetTime(args: string[]): { title: string; start: Date } {
  const tz = "America/Sao_Paulo";
  const full = args.join(" ").trim();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));

  if (args.length === 0 || /^agora$/i.test(full)) {
    return { title: "Reunião", start: new Date() };
  }

  const timeRegex = /\bà?s?\s*(\d{1,2})(?:[h:](\d{2}))?h?\b/i;
  const tomorrowRegex = /\bamanhã\b/i;
  const nowRegex = /\bagora\b/i;

  const timeMatch = full.match(timeRegex);
  const isTomorrow = tomorrowRegex.test(full);
  const isNow = nowRegex.test(full);

  const title =
    full
      .replace(timeRegex, "")
      .replace(tomorrowRegex, "")
      .replace(nowRegex, "")
      .replace(/\s+/g, " ")
      .trim() || "Reunião";

  if (isNow) {
    return { title, start: new Date() };
  }

  const start = new Date();
  if (timeMatch) {
    const h = parseInt(timeMatch[1]);
    const m = parseInt(timeMatch[2] ?? "0");
    start.setHours(h, m, 0, 0);
    if (isTomorrow) {
      start.setDate(start.getDate() + 1);
    } else {
      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      if (start <= nowLocal) start.setDate(start.getDate() + 1);
    }
  } else {
    // sem horário → próxima hora cheia
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    if (isTomorrow) start.setDate(start.getDate() + 1);
  }

  return { title, start };
}

async function handleMeet(userId: string, args: string[]): Promise<string> {
  const tokenResult = await getValidAccessToken(userId);
  if ("error" in tokenResult) {
    return "Google Calendar não conectado. Conecte em Configurações > Integrações.";
  }

  const tz = "America/Sao_Paulo";

  // Formato DD/MM [HH:MM] Nome → compromisso (sem link de vídeo)
  if (args.length > 0 && /^\d{1,2}\/\d{1,2}$/.test(args[0])) {
    const [dayStr, monthStr] = args[0].split("/");
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);

    const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    let year = nowBR.getFullYear();
    if (new Date(year, month - 1, day) < nowBR) year++;

    const rest = args.slice(1);
    const timeMatch = rest[0]?.match(/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/);

    let eventBody: Record<string, unknown>;
    let timeInfo: string;

    if (timeMatch) {
      const hStart = parseInt(timeMatch[1], 10);
      const mStart = parseInt(timeMatch[2], 10);
      const hEnd = timeMatch[3] ? parseInt(timeMatch[3], 10) : hStart + 1;
      const mEnd = timeMatch[4] ? parseInt(timeMatch[4], 10) : mStart;
      const title = rest.slice(1).join(" ").trim() || "Compromisso";

      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      eventBody = {
        summary: title,
        start: { dateTime: `${dateStr}T${pad(hStart)}:${pad(mStart)}:00`, timeZone: tz },
        end: { dateTime: `${dateStr}T${pad(hEnd)}:${pad(mEnd)}:00`, timeZone: tz },
      };
      timeInfo = `${pad(hStart)}:${pad(mStart)}–${pad(hEnd)}:${pad(mEnd)}`;
    } else {
      const title = rest.join(" ").trim() || "Compromisso";
      const pad = (n: number) => String(n).padStart(2, "0");
      const startDate = `${year}-${pad(month)}-${pad(day)}`;
      const nextDay = new Date(year, month - 1, day + 1);
      const endDate = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;
      eventBody = {
        summary: title,
        start: { date: startDate },
        end: { date: endDate },
      };
      timeInfo = "dia inteiro";
    }

    const res = await googleJson(
      tokenResult.accessToken,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
      { method: "POST", body: JSON.stringify(eventBody) },
    );

    if (!res.ok) {
      return `Erro ao criar compromisso: ${res.text || "falha desconhecida"}`;
    }

    const summary = (eventBody.summary as string);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateLabel = `${pad(day)}/${pad(month)}/${year}`;
    return `✅ *${summary}*\n📅 ${dateLabel} — ${timeInfo}\n📋 Compromisso criado na agenda`;
  }

  // Formato original: reunião com Google Meet
  const { title, start } = parseMeetTime(args);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const eventBody = {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const res = await googleJson(
    tokenResult.accessToken,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none",
    { method: "POST", body: JSON.stringify(eventBody) },
  );

  if (!res.ok || !res.data) {
    return `Erro ao criar reunião: ${res.text || "falha desconhecida"}`;
  }

  const meetLink = (res.data as Record<string, unknown>).hangoutLink as string | undefined;
  const htmlLink = (res.data as Record<string, unknown>).htmlLink as string | undefined;

  const timeStr = start.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const endStr = end.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const dateStr = start.toLocaleDateString("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "short" });

  if (meetLink) {
    return `✅ *${title}*\n📅 ${dateStr} • ${timeStr}–${endStr}\n🔗 ${meetLink}`;
  }

  return `✅ Evento criado: ${htmlLink || "sem link"}`;
}

async function handleTask(userId: string, args: string[]): Promise<string> {
  if (args.length === 0) return "Use: /task [título da tarefa]";

  const title = args.join(" ");
  await ensureDatabaseConnection();

  const maxPosRows = await sql<{ max: number | null }[]>`
    SELECT MAX(position) as max FROM tasks WHERE user_id = ${userId} AND column_index = 0
  `;
  const maxPos = maxPosRows[0]?.max ?? 0;

  await sql`
    INSERT INTO tasks (user_id, title, column_index, position)
    VALUES (${userId}, ${title}, 0, ${(maxPos ?? 0) + 1000})
  `;

  return `✅ Tarefa criada: *${title}*`;
}

async function handleGrana(userId: string): Promise<string> {
  await ensureDatabaseConnection();

  const since = new Date();
  since.setDate(1);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await sql<{ type: string; amount: number; status: string }[]>`
    SELECT type, amount, status
    FROM financial_entries
    WHERE user_id = ${userId} AND due_date >= ${sinceStr}
  `;

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter((r) => r.status === "pending");
  const overdue = rows.filter((r) => r.status === "overdue");

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lines = [
    `💰 *Financeiro (mês atual)*`,
    `📈 Receitas: ${fmt(income)}`,
    `📉 Despesas: ${fmt(expense)}`,
    `💵 Lucro: ${fmt(income - expense)}`,
    pending.length > 0 ? `⏳ Pendentes: ${pending.length} (${fmt(pending.reduce((s, r) => s + Number(r.amount), 0))})` : "",
    overdue.length > 0 ? `🚨 Vencidos: ${overdue.length} (${fmt(overdue.reduce((s, r) => s + Number(r.amount), 0))})` : "",
  ].filter(Boolean);

  // Mercado Pago
  if (mpConfigured()) {
    try {
      const [balance, moneyBoxes, payments] = await Promise.all([
        getBalance(),
        getMoneyBoxes(),
        getRecentPayments(500),
      ]);

      lines.push("");
      lines.push(`🟡 *Mercado Pago*`);

      if (balance) {
        const total = Number(balance.available_balance ?? balance.total_amount ?? 0);
        lines.push(`💳 Saldo disponível: ${fmt(total)}`);
      }

      // Cofrinhos via money-boxes API
      if (moneyBoxes.length > 0) {
        lines.push(`🐷 *Cofrinhos:*`);
        for (const box of moneyBoxes) {
          lines.push(`  • ${box.name}: ${fmt(Number(box.current_amount ?? 0))}`);
        }
      } else {
        // Fallback via pagamentos
        const cofrinhos = extractCofrinhos(payments);
        if (cofrinhos.length > 0) {
          lines.push(`🐷 *Cofrinhos:*`);
          for (const c of cofrinhos) {
            lines.push(`  • ${c.name}: ${fmt(c.amount)}`);
          }
        }
      }
    } catch (err) {
      lines.push("");
      lines.push(`🟡 *Mercado Pago*: erro ao buscar dados`);
    }
  }

  return lines.join("\n");
}

async function handleTimer(userId: string, args: string[]): Promise<string> {
  await ensureDatabaseConnection();

  const sub = args[0]?.toLowerCase();

  if (sub === "stop" || sub === "parar") {
    const openRows = await sql<{ id: string; started_at: string; project_name: string | null }[]>`
      SELECT ts.id, ts.started_at, p.name as project_name
      FROM time_sessions ts
      LEFT JOIN projects p ON ts.project_id = p.id
      WHERE ts.user_id = ${userId} AND ts.ended_at IS NULL
      ORDER BY ts.started_at DESC
      LIMIT 1
    `;

    if (openRows.length === 0) return "Nenhuma sessão ativa para parar.";

    const session = openRows[0];
    const now = new Date();
    const started = new Date(session.started_at);
    const durationSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);

    await sql`
      UPDATE time_sessions
      SET ended_at = NOW(), duration_seconds = ${durationSeconds}
      WHERE id = ${session.id}
    `;

    const minutes = Math.floor(durationSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const durationStr = hours > 0 ? `${hours}h${remainingMinutes}min` : `${minutes}min`;

    return `⏹ Timer parado${session.project_name ? ` (${session.project_name})` : ""}.\n⏱ Duração: ${durationStr}`;
  }

  if (sub === "start" || sub === "iniciar" || !sub) {
    const projectNamePart = (sub === "start" || sub === "iniciar") ? args.slice(1).join(" ").trim() : args.join(" ").trim();
    const projectName = projectNamePart || null;

    let projectId: string | null = null;
    if (projectName) {
      const projRows = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM projects
        WHERE user_id = ${userId} AND LOWER(name) LIKE ${"%" + projectName.toLowerCase() + "%"}
        LIMIT 1
      `;
      projectId = projRows[0]?.id ?? null;

      if (!projectId) {
        return `Projeto "${projectName}" não encontrado. Use /timer start ou /timer start [parte do nome].`;
      }
    }

    const openCount = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM time_sessions
      WHERE user_id = ${userId} AND ended_at IS NULL
    `;

    if ((openCount[0]?.count ?? 0) > 0) {
      return "Já existe uma sessão ativa. Use /timer stop primeiro.";
    }

    if (projectId) {
      await sql`
        INSERT INTO time_sessions (user_id, project_id, started_at)
        VALUES (${userId}, ${projectId}, NOW())
      `;
      const projRows = await sql<{ name: string }[]>`SELECT name FROM projects WHERE id = ${projectId}`;
      return `▶️ Timer iniciado para *${projRows[0]?.name ?? projectName}*`;
    } else {
      await sql`
        INSERT INTO time_sessions (user_id, started_at)
        VALUES (${userId}, NOW())
      `;
      return "▶️ Timer iniciado (sem projeto vinculado)";
    }
  }

  return "Use: /timer start [projeto] ou /timer stop";
}

async function handleLembrete(userId: string, args: string[]): Promise<string> {
  if (args.length === 0) return "Use: /lembrete [título] (amanhã às 10h, por padrão)";

  const title = args.join(" ");

  const tokenResult = await getValidAccessToken(userId);
  if ("error" in tokenResult) {
    return "Google Calendar não conectado. Conecte em Configurações > Integrações.";
  }

  const tz = "America/Sao_Paulo";
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const eventBody = {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
  };

  const res = await googleJson(
    tokenResult.accessToken,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
    { method: "POST", body: JSON.stringify(eventBody) },
  );

  if (!res.ok) {
    return `Erro ao criar lembrete: ${res.text || "falha desconhecida"}`;
  }

  const dateStr = start.toLocaleDateString("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "short" });
  return `✅ Lembrete criado: *${title}*\n📅 ${dateStr} às 10:00`;
}

async function handleClima(): Promise<string> {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=-22.5647&longitude=-47.4017" +
    "&current=temperature_2m,weather_code,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    "&timezone=America%2FSao_Paulo&forecast_days=1";

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return "Não foi possível obter o clima agora. Tente novamente.";
  }

  const current = data.current as Record<string, number> | undefined;
  const daily = data.daily as Record<string, number[]> | undefined;
  if (!current) return "Dados de clima indisponíveis.";

  const temp = Math.round(current.temperature_2m);
  const code = current.weather_code;
  const isDay = current.is_day === 1;
  const label = (WEATHER_CODES[code] ?? { day: "Clima estável", night: "Clima estável" })[isDay ? "day" : "night"];
  const emoji = WEATHER_EMOJIS[code] ?? "🌡";
  const max = daily ? Math.round(daily.temperature_2m_max[0]) : null;
  const min = daily ? Math.round(daily.temperature_2m_min[0]) : null;

  const lines = [`${emoji} *Limeira, SP*`, `🌡 ${temp}°C — ${label}`];
  if (min !== null && max !== null) lines.push(`📊 Mín ${min}° / Máx ${max}°`);
  return lines.join("\n");
}

async function handleHoje(userId: string): Promise<string> {
  const tz = "America/Sao_Paulo";
  const sections: string[] = [];

  // Clima
  try {
    const clima = await handleClima();
    sections.push(clima);
  } catch {}

  // Eventos do Google Calendar hoje
  try {
    const tokenResult = await getValidAccessToken(userId);
    if (!("error" in tokenResult)) {
      const now = new Date();
      const startOfDay = new Date(now.toLocaleDateString("en-CA", { timeZone: tz }) + "T00:00:00");
      const endOfDay = new Date(now.toLocaleDateString("en-CA", { timeZone: tz }) + "T23:59:59");
      const params = new URLSearchParams({
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "5",
      });
      const res = await googleJson(
        tokenResult.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { method: "GET" },
      );
      const items = ((res.data as Record<string, unknown>)?.items as Array<Record<string, unknown>>) ?? [];
      if (items.length > 0) {
        const eventLines = items.map((ev) => {
          const start = ev.start as Record<string, string> | undefined;
          const time = start?.dateTime
            ? new Date(start.dateTime).toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
            : "dia todo";
          return `  • ${time} — ${ev.summary ?? "Sem título"}`;
        });
        sections.push(`📅 *Agenda de hoje*\n${eventLines.join("\n")}`);
      }
    }
  } catch {}

  // Tarefas pendentes (primeiras 5 do kanban)
  try {
    await ensureDatabaseConnection();
    const tasks = await sql<{ title: string }[]>`
      SELECT title FROM tasks
      WHERE user_id = ${userId} AND column_index = 0
      ORDER BY position ASC LIMIT 5
    `;
    if (tasks.length > 0) {
      const taskLines = tasks.map((t) => `  • ${t.title}`).join("\n");
      sections.push(`✅ *Tarefas pendentes*\n${taskLines}`);
    }
  } catch {}

  // Timer ativo
  try {
    await ensureDatabaseConnection();
    const active = await sql<{ started_at: string; project_name: string | null }[]>`
      SELECT ts.started_at, p.name as project_name
      FROM time_sessions ts
      LEFT JOIN projects p ON ts.project_id = p.id
      WHERE ts.user_id = ${userId} AND ts.ended_at IS NULL
      LIMIT 1
    `;
    if (active.length > 0) {
      const session = active[0];
      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
      const h = Math.floor(elapsed / 60);
      const m = elapsed % 60;
      const duration = h > 0 ? `${h}h${m}min` : `${m}min`;
      const proj = session.project_name ? ` — ${session.project_name}` : "";
      sections.push(`⏱ *Timer ativo${proj}*: ${duration}`);
    }
  } catch {}

  if (sections.length === 0) return "Nada encontrado para hoje.";
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long" });
  return `*${today.charAt(0).toUpperCase() + today.slice(1)}*\n\n${sections.join("\n\n")}`;
}

function detectPixKeyType(raw: string): { type: string; value: string } | null {
  const trimmed = raw.trim();

  // Email
  if (trimmed.includes("@")) return { type: "email", value: trimmed };

  // EVP (UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { type: "evp", value: trimmed };
  }

  // CPF formatado: XXX.XXX.XXX-XX
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)) {
    return { type: "cpf", value: trimmed.replace(/\D/g, "") };
  }

  const digits = trimmed.replace(/\D/g, "");

  // Telefone: 10-11 dígitos (DDD + número, com ou sem 9 na frente)
  if (digits.length >= 10 && digits.length <= 11) {
    return { type: "phone", value: "+55" + digits };
  }

  // Telefone com código de país: +55 + 11 dígitos = 13 dígitos
  if (digits.length === 13 && digits.startsWith("55")) {
    return { type: "phone", value: "+" + digits };
  }

  return null;
}

const PIX_KEY_LABELS: Record<string, string> = {
  phone: "celular",
  cpf: "CPF",
  email: "e-mail",
  evp: "chave aleatória",
};

async function handlePix(_userId: string, args: string[]): Promise<string> {
  if (!interConfigured()) {
    return "Banco Inter não configurado (faltam credenciais/certificado).";
  }

  const confirm = args[args.length - 1]?.toLowerCase() === "sim";
  const effectiveArgs = confirm ? args.slice(0, -1) : args;

  if (effectiveArgs.length < 2) {
    return "Use: /pix <chave> <valor>\nEx: /pix 11999999999 50";
  }

  const rawKey = effectiveArgs[0];
  const rawAmount = effectiveArgs[1];
  const amount = parseFloat(rawAmount.replace(",", "."));

  if (isNaN(amount) || amount <= 0) {
    return "Valor inválido. Ex: /pix 11999999999 50";
  }

  const key = detectPixKeyType(rawKey);
  if (!key) {
    return `Chave PIX não reconhecida: *${rawKey}*\nFormatos aceitos: celular, CPF, e-mail ou chave aleatória.`;
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const label = PIX_KEY_LABELS[key.type] ?? key.type;

  if (!confirm) {
    return `💸 *Confirmar PIX?*\n📤 Valor: ${fmt(amount)}\n🔑 Chave (${label}): ${key.value}\n\nPara enviar: /pix ${rawKey} ${rawAmount} sim`;
  }

  try {
    const result = await interSendPix(key.value, amount, "PIX via WorkOS");
    const statusMap: Record<string, string> = {
      PROCESSADO: "processado",
      AGENDADO: "agendado",
    };
    const statusMsg = statusMap[result.tipoRetorno] ?? result.tipoRetorno.toLowerCase();
    return `✅ *PIX enviado!*\n💸 ${fmt(amount)} → ${key.value}\n📋 Cód: ${result.codigoSolicitacao}\n📌 Status: ${statusMsg}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `❌ Erro ao enviar PIX: ${msg}`;
  }
}

async function handleMp(): Promise<string> {
  if (!mpConfigured()) {
    return "Mercado Pago não configurado. Adicione MERCADOPAGO_ACCESS_TOKEN nas configurações.";
  }

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  try {
    const [balance, moneyBoxes, payments] = await Promise.all([
      getBalance(),
      getMoneyBoxes(),
      getRecentPayments(500),
    ]);

    const lines: string[] = ["🟡 *Mercado Pago*"];

    if (balance) {
      const available = Number(balance.available_balance ?? 0);
      lines.push(`💳 Saldo disponível: ${fmt(available)}`);
    }

    if (moneyBoxes.length > 0) {
      const total = moneyBoxes.reduce((s, b) => s + Number(b.current_amount ?? 0), 0);
      lines.push(`\n🐷 *Cofrinhos* (total: ${fmt(total)})`);
      for (const box of moneyBoxes) {
        lines.push(`  • ${box.name}: ${fmt(Number(box.current_amount ?? 0))}`);
      }
    } else {
      const cofrinhos = extractCofrinhos(payments);
      if (cofrinhos.length > 0) {
        const total = cofrinhos.reduce((s, c) => s + c.amount, 0);
        lines.push(`\n🐷 *Cofrinhos* (total: ${fmt(total)})`);
        for (const c of cofrinhos) {
          lines.push(`  • ${c.name}: ${fmt(c.amount)}`);
        }
      } else {
        lines.push(`🐷 Nenhum cofrinho encontrado`);
      }
    }

    return lines.join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Erro ao buscar dados do Mercado Pago: ${msg}`;
  }
}

const HELP_TEXT = `🤖 *WorkOS Bot*
_seu assistente no WhatsApp_

📅 *AGENDA & DIA*
☀️ */hoje* — _resumo do dia: clima, agenda, tarefas e timer_
🌡️ */clima* — _tempo agora_
📌 */meet* _DD/MM Nome_ — _compromisso dia inteiro_
🕒 */meet* _DD/MM HH:MM Nome_ — _compromisso com horário_
🔔 */lembrete* _título_ — _lembrete amanhã às 10h_

🎥 *REUNIÕES* _(com link do Meet)_
▶️ */meet* _título_ *agora* — _reunião na hora_
⏰ */meet* _título_ *às 15h30* — _reunião no horário_

💸 *FINANCEIRO*
💰 */grana* — _resumo financeiro do mês_
🟡 */mp* — _saldo e cofrinhos do Mercado Pago_
📤 */pix* _chave valor_ — _mostra o preview_
✅ */pix* _chave valor_ *sim* — _envia o PIX_

✔️ *PRODUTIVIDADE*
📝 */task* _título_ — _nova tarefa no kanban_
⏱️ */timer start* _projeto_ — _inicia o cronômetro_
⏹️ */timer stop* — _para o cronômetro_

💡 _Dica: digite_ */hoje* _pra começar o dia._`;

export async function runCommand(
  userId: string,
  parsed: ParsedCommand,
): Promise<string> {
  const { command, args } = parsed;

  switch (command) {
    case "hoje":
      return handleHoje(userId);
    case "clima":
      return handleClima();
    case "meet":
      return handleMeet(userId, args);
    case "task":
      return handleTask(userId, args);
    case "grana":
      return handleGrana(userId);
    case "mp":
    case "mercadopago":
    case "mercadolivre":
      return handleMp();
    case "timer":
      return handleTimer(userId, args);
    case "lembrete":
      return handleLembrete(userId, args);
    case "pix":
      return handlePix(userId, args);
    case "help":
    case "ajuda":
      return HELP_TEXT;
    default:
      return `❓ Não conheço o comando */${command}*.\n\n${HELP_TEXT}`;
  }
}
