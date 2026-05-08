import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function mpGet(path: string, token: string) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, { status: 503 });
  }

  const [balance, movements, payments, savings, wallet] = await Promise.all([
    mpGet("/v1/account/balance", token),
    mpGet("/v1/account/movements/search?limit=5", token),
    mpGet("/v1/payments/search?limit=2&sort=date_created&criteria=desc", token),
    mpGet("/v1/account/savings", token),
    mpGet("/v1/wallet", token),
  ]);

  return NextResponse.json({ balance, movements, payments, savings, wallet });
}
