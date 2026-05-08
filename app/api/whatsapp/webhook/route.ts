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

async function findOwnerUser(): Promise<string | null> {
  await ensureDatabaseConnection();
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM profiles WHERE whatsapp_number IS NOT NULL LIMIT 1
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

  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // webhookBase64: true envia body.data como string base64 em vez de objeto
  let body: EvolutionMessageEvent = rawBody as EvolutionMessageEvent;
  if (typeof rawBody.data === "string") {
    try {
      const decoded = JSON.parse(Buffer.from(rawBody.data, "base64").toString("utf-8"));
      body = { ...rawBody, data: decoded } as EvolutionMessageEvent;
    } catch {
      // mantém rawBody se falhar decode
    }
  }

  if (body.event !== "messages.upsert") {
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

  const fromMe = body.data?.key?.fromMe ?? false;
  const conversationPhone = extractPhone(remoteJid);

  let userId: string | null;
  try {
    if (fromMe) {
      // Remetente é o dono da instância — autentica pelo número registrado (env) ou busca no banco
      const ownerNumber = process.env.EVOLUTION_OWNER_NUMBER;
      userId = ownerNumber
        ? await findUserByPhone(ownerNumber)
        : await findOwnerUser();
    } else {
      userId = await findUserByPhone(conversationPhone);
    }
  } catch (err) {
    console.error("[whatsapp webhook] erro ao buscar usuário:", err);
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  let reply: string;
  try {
    reply = await runCommand(userId, parsed);
  } catch (err) {
    console.error("[whatsapp webhook] erro ao executar comando:", err);
    reply = `Erro ao executar /${parsed.command}. Tente novamente.`;
  }

  // Sempre responde na conversa onde o comando foi enviado
  try {
    await sendTextMessage(conversationPhone, reply);
  } catch (err) {
    console.error("[whatsapp webhook] erro ao enviar resposta:", err);
  }

  return NextResponse.json({ ok: true });
}
