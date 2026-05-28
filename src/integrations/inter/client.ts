import { Agent, fetch } from "undici";

/**
 * Cliente da API do Banco Inter Empresas (PJ).
 * Autenticação: OAuth2 client_credentials + mTLS (certificado de cliente).
 *
 * Env vars necessárias:
 *  - INTER_CLIENT_ID       — Client ID da integração (Internet Banking > Integrações)
 *  - INTER_CLIENT_SECRET   — Client Secret da integração
 *  - INTER_CERT_BASE64     — certificado .crt em base64
 *  - INTER_KEY_BASE64      — chave privada .key em base64
 *  - INTER_CONTA_CORRENTE  — (opcional) número da conta, se a integração tiver mais de uma
 */

const BASE_URL = "https://cdpj.partners.bancointer.com.br";
const SCOPE_PIX_WRITE = "pagamento-pix.write";

type InterToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

type PixTransferResult = {
  codigoSolicitacao: string;
  tipoRetorno: string;
  dataPagamento?: string;
  dataOperacao?: string;
};

// Cache do token em memória do processo (expira em ~1h)
let cachedToken: { value: string; expiresAt: number } | null = null;
let cachedAgent: Agent | null = null;

function getEnv() {
  const clientId = process.env.INTER_CLIENT_ID;
  const clientSecret = process.env.INTER_CLIENT_SECRET;
  const certB64 = process.env.INTER_CERT_BASE64;
  const keyB64 = process.env.INTER_KEY_BASE64;
  if (!clientId || !clientSecret || !certB64 || !keyB64) {
    throw new Error("Banco Inter não configurado (faltam credenciais ou certificado).");
  }
  return {
    clientId,
    clientSecret,
    cert: Buffer.from(certB64, "base64").toString("utf-8"),
    key: Buffer.from(keyB64, "base64").toString("utf-8"),
    contaCorrente: process.env.INTER_CONTA_CORRENTE || null,
  };
}

function getAgent(cert: string, key: string): Agent {
  if (!cachedAgent) {
    cachedAgent = new Agent({ connect: { cert, key } });
  }
  return cachedAgent;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const { clientId, clientSecret, cert, key } = getEnv();
  const agent = getAgent(cert, key);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: SCOPE_PIX_WRITE,
  });

  const res = await fetch(`${BASE_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    dispatcher: agent,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha na autenticação Inter (${res.status}): ${text}`);
  }

  const token = (await res.json()) as InterToken;
  cachedToken = {
    value: token.access_token,
    expiresAt: now + token.expires_in * 1000,
  };
  return token.access_token;
}

/**
 * Envia um PIX por chave (celular, CPF, e-mail ou aleatória).
 * @param chave  valor da chave PIX do destinatário
 * @param valor  valor em reais (ex: 50.00)
 * @param descricao  descrição opcional (até 140 chars)
 */
export async function sendPix(
  chave: string,
  valor: number,
  descricao = "",
): Promise<PixTransferResult> {
  const { cert, key, contaCorrente } = getEnv();
  const agent = getAgent(cert, key);
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (contaCorrente) headers["x-conta-corrente"] = contaCorrente;

  const payload = {
    valor: Number(valor.toFixed(2)),
    descricao: descricao.slice(0, 140),
    destinatario: {
      tipo: "CHAVE",
      chave,
    },
  };

  const res = await fetch(`${BASE_URL}/banking/v2/pix`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    dispatcher: agent,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (data.detail as string) ??
      (data.title as string) ??
      (data.message as string) ??
      `Erro ${res.status}`;
    throw new Error(msg);
  }

  return {
    codigoSolicitacao: data.codigoSolicitacao as string,
    tipoRetorno: (data.tipoRetorno as string) ?? "PROCESSADO",
    dataPagamento: data.dataPagamento as string | undefined,
    dataOperacao: data.dataOperacao as string | undefined,
  };
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.INTER_CLIENT_ID &&
      process.env.INTER_CLIENT_SECRET &&
      process.env.INTER_CERT_BASE64 &&
      process.env.INTER_KEY_BASE64,
  );
}
