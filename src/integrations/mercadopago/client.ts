import type {
  MpBalance,
  MpMoneyBox,
  MpMovement,
  MpMovementsResponse,
  MpPayment,
  MpPaymentsResponse,
} from "./types";

const BASE_URL = "https://api.mercadopago.com";

function getToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return token;
}

async function mpFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MP API ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getBalance(): Promise<MpBalance> {
  return mpFetch<MpBalance>("/v1/account/balance");
}

export async function getMovements(limit = 50, offset = 0): Promise<{ results: MpMovement[]; total: number }> {
  const data = await mpFetch<MpMovementsResponse>("/v1/account/movements/search", {
    limit: String(limit),
    offset: String(offset),
  });
  return { results: data.results ?? [], total: data.paging?.total ?? 0 };
}

export async function getRecentPayments(limit = 20): Promise<MpPayment[]> {
  const data = await mpFetch<MpPaymentsResponse>("/v1/payments/search", {
    limit: String(limit),
    sort: "date_created",
    criteria: "desc",
  });
  return data.results ?? [];
}

export async function getMoneyBoxes(): Promise<MpMoneyBox[]> {
  try {
    const data = await mpFetch<{ money_boxes?: MpMoneyBox[] }>("/v1/money-boxes");
    return data.money_boxes ?? [];
  } catch {
    return [];
  }
}

export function isConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}
