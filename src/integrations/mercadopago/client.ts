import type {
  MpBalance,
  MpCofrinho,
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

export async function getBalance(): Promise<MpBalance | null> {
  try {
    return await mpFetch<MpBalance>("/v1/account/balance");
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function getMovements(limit = 50, offset = 0): Promise<{ results: MpMovement[]; total: number }> {
  try {
    const data = await mpFetch<MpMovementsResponse>("/v1/account/movements/search", {
      limit: String(limit),
      offset: String(offset),
    });
    return { results: data.results ?? [], total: data.paging?.total ?? 0 };
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return { results: [], total: 0 };
    throw err;
  }
}

export async function getRecentPayments(limit = 50): Promise<MpPayment[]> {
  const data = await mpFetch<MpPaymentsResponse>("/v1/payments/search", {
    limit: String(limit),
    sort: "date_created",
    criteria: "desc",
  });
  return data.results ?? [];
}

export function extractCofrinhos(payments: MpPayment[]): MpCofrinho[] {
  const map = new Map<string, number>();

  for (const p of payments) {
    // Depósito INTO cofrinho: collector recebe no subpartition
    const destSub = p.amounts?.collector?.transaction_destination?.subpartition;
    if (destSub?.name) {
      map.set(destSub.name, (map.get(destSub.name) ?? 0) + p.transaction_amount);
    }

    // Saque FROM cofrinho: payer envia do subpartition
    const srcPartitions = p.amounts?.payer?.transaction_source?.partitions;
    if (srcPartitions) {
      for (const part of srcPartitions) {
        if (part.subpartition?.name) {
          const net = part.amount - (part.amount_refunded ?? 0);
          map.set(part.subpartition.name, (map.get(part.subpartition.name) ?? 0) - net);
        }
      }
    }
  }

  return Array.from(map.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100, currency_id: "BRL" }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getMoneyBoxes(): Promise<MpMoneyBox[]> {
  try {
    const data = await mpFetch<{ money_boxes?: Record<string, unknown>[] }>("/v1/money-boxes");
    const boxes = data.money_boxes ?? [];
    if (boxes.length > 0) {
      console.log("[MP money-boxes] primeiro item raw:", JSON.stringify(boxes[0]));
    }
    return boxes as unknown as MpMoneyBox[];
  } catch {
    return [];
  }
}

export function isConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}
