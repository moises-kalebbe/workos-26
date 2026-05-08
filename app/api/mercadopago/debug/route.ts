import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const res = await fetch("https://api.mercadopago.com/v1/money-boxes", {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  const raw = await res.json();
  return NextResponse.json({ status: res.status, raw });
}
