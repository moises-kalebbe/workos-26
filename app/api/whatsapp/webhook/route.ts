import { NextResponse } from "next/server";
import { sql, ensureDatabaseConnection } from "@/lib/db";
import { sendTextMessage } from "@/lib/evolutionApi";
import { parseCommand, runCommand } from "@/lib/whatsappCommands";

export const runtime = "nodejs";

type EvolutionMessageEvent = {
  event?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    messageType?: string;
  };
};

function extractPhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "");
}

function extractMessageText(event: EvolutionMessageEvent): string | null {
  const msg = event.data?.message;
  if (!msg) return null;
  return msg.conversation ?? msg.extendedTextMessage?.text ?? null;
}

async function findUserByPhone(phone: string): Promise<string | null> {
  await ensureDatabaseConnection();
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE whatsapp_number = ${phone} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function POST(request: Request) {
  const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (webhookToken) {
    const incoming = request.headers.get("apikey") ?? request.headers.get("x-webhook-token");
    if (incoming !== webhookToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: EvolutionMessageEvent;
  try {
    body = (await request.json()) as EvolutionMessageEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "messages.upsert") {
    return NextResponse.json({ ok: true });
  }

  if (body.data?.key?.fromMe) {
    return NextResponse.json({ ok: true });
  }

  const remoteJid = body.data?.key?.remoteJid;
  if (!remoteJid || remoteJid.includes("@g.us")) {
    return NextResponse.json({ ok: true });
  }

  const text = extractMessageText(body);
  if (!text) return NextResponse.json({ ok: true });

  const parsed = parseCommand(text);
  if (!parsed) return NextResponse.json({ ok: true });

  const phone = extractPhone(remoteJid);

  let userId: string | null;
  try {
    userId = await findUserByPhone(phone);
  } catch (err) {
    console.error("[whatsapp webhook] erro ao buscar usuário:", err);
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    try {
      await sendTextMessage(phone, "Número não cadastrado. Acesse Configurações > Integrações no WorkOS para registrar seu número.");
    } catch {}
    return NextResponse.json({ ok: true });
  }

  let reply: string;
  try {
    reply = await runCommand(userId, parsed);
  } catch (err) {
    console.error("[whatsapp webhook] erro ao executar comando:", err);
    reply = `Erro ao executar /${parsed.command}. Tente novamente.`;
  }

  try {
    await sendTextMessage(phone, reply);
  } catch (err) {
    console.error("[whatsapp webhook] erro ao enviar resposta:", err);
  }

  return NextResponse.json({ ok: true });
}
