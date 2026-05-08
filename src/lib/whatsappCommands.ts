import { sql, ensureDatabaseConnection } from "@/lib/db";
import { getValidAccessToken, googleJson } from "@/lib/googleCalendar";

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

  return [
    `💰 *Financeiro (mês atual)*`,
    `📈 Receitas: ${fmt(income)}`,
    `📉 Despesas: ${fmt(expense)}`,
    `💵 Lucro: ${fmt(income - expense)}`,
    pending.length > 0 ? `⏳ Pendentes: ${pending.length} (${fmt(pending.reduce((s, r) => s + Number(r.amount), 0))})` : "",
    overdue.length > 0 ? `🚨 Vencidos: ${overdue.length} (${fmt(overdue.reduce((s, r) => s + Number(r.amount), 0))})` : "",
  ]
    .filter(Boolean)
    .join("\n");
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

const HELP_TEXT = `*WorkOS Bot* — Comandos disponíveis:

/clima — Temperatura e condição do tempo atual
/meet [título] — Reunião na próxima hora cheia
/meet [título] agora — Reunião instantânea
/meet [título] às 15h30 — Reunião no horário
/meet [título] amanhã às 10h — Reunião amanhã
/task [título] — Cria tarefa no kanban
/grana — Resumo financeiro do mês
/timer start [projeto] — Inicia o timer
/timer stop — Para o timer atual
/lembrete [título] — Cria lembrete para amanhã às 10h`;

export async function runCommand(
  userId: string,
  parsed: ParsedCommand,
): Promise<string> {
  const { command, args } = parsed;

  switch (command) {
    case "clima":
      return handleClima();
    case "meet":
      return handleMeet(userId, args);
    case "task":
      return handleTask(userId, args);
    case "grana":
      return handleGrana(userId);
    case "timer":
      return handleTimer(userId, args);
    case "lembrete":
      return handleLembrete(userId, args);
    case "help":
    case "ajuda":
      return HELP_TEXT;
    default:
      return `Comando /${command} não reconhecido.\n\n${HELP_TEXT}`;
  }
}
