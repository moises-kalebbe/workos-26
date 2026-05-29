import https from "node:https";

/**
 * Cliente da API do Banco Inter Empresas (PJ).
 * Autenticação: OAuth2 client_credentials + mTLS (certificado de cliente).
 *
 * Usa o módulo nativo node:https (mTLS via cert/key) — sem dependência de undici,
 * que conflita com o undici interno do Node durante o build do Next.
 *
 * Env vars necessárias:
 *  - INTER_CLIENT_ID       — Client ID da integração (Internet Banking > Integrações)
 *  - INTER_CLIENT_SECRET   — Client Secret da integração
 *  - INTER_CERT_BASE64     — certificado .crt em base64
 *  - INTER_KEY_BASE64      — chave privada .key em base64
 *  - INTER_CONTA_CORRENTE  — (opcional) número da conta, se a integração tiver mais de uma
 */

const HOST = "cdpj.partners.bancointer.com.br";
const SCOPE_PIX_WRITE = "pagamento-pix.write";

type PixTransferResult = {
  codigoSolicitacao: string;
  tipoRetorno: string;
  dataPagamento?: string;
  dataOperacao?: string;
};

// Cache de token por scope (expira em ~1h)
const tokenCache = new Map<string, { value: string; expiresAt: number }>();
let cachedAgent: https.Agent | null = null;

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

function getAgent(cert: string, key: string): https.Agent {
  if (!cachedAgent) {
    cachedAgent = new https.Agent({ cert, key, keepAlive: true });
  }
  return cachedAgent;
}

type HttpResponse = { status: number; data: Record<string, unknown>; raw: string };

function request(
  path: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  agent: https.Agent,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        port: 443,
        path,
        method,
        headers,
        agent,
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf-8");
        res.on("data", (d) => {
          chunks += d;
        });
        res.on("end", () => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = chunks ? (JSON.parse(chunks) as Record<string, unknown>) : {};
          } catch {
            parsed = {};
          }
          resolve({ status: res.statusCode ?? 0, data: parsed, raw: chunks });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(scope: string): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.value;
  }

  const { clientId, clientSecret, cert, key } = getEnv();
  const agent = getAgent(cert, key);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope,
  }).toString();

  const res = await request(
    "/oauth/v2/token",
    "POST",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
    agent,
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Falha na autenticação Inter (${res.status}): ${res.raw}`);
  }

  const accessToken = res.data.access_token as string;
  const expiresIn = (res.data.expires_in as number) ?? 3600;
  tokenCache.set(scope, {
    value: accessToken,
    expiresAt: now + expiresIn * 1000,
  });
  return accessToken;
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
  const token = await getAccessToken(SCOPE_PIX_WRITE);

  const payload = JSON.stringify({
    valor: Number(valor.toFixed(2)),
    descricao: descricao.slice(0, 140),
    destinatario: {
      tipo: "CHAVE",
      chave,
    },
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(payload)),
  };
  if (contaCorrente) headers["x-conta-corrente"] = contaCorrente;

  const res = await request("/banking/v2/pix", "POST", headers, payload, agent);

  if (res.status < 200 || res.status >= 300) {
    const msg =
      (res.data.detail as string) ??
      (res.data.title as string) ??
      (res.data.message as string) ??
      res.raw ??
      `Erro ${res.status}`;
    throw new Error(msg);
  }

  return {
    codigoSolicitacao: res.data.codigoSolicitacao as string,
    tipoRetorno: (res.data.tipoRetorno as string) ?? "PROCESSADO",
    dataPagamento: res.data.dataPagamento as string | undefined,
    dataOperacao: res.data.dataOperacao as string | undefined,
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
