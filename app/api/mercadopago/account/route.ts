import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getBalance,
  getMoneyBoxes,
  getMovements,
  getRecentPayments,
  isConfigured,
} from "@/integrations/mercadopago/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "MERCADOPAGO_ACCESS_TOKEN não configurado" },
      { status: 503 },
    );
  }

  try {
    const [balance, movementsData, recentPayments, moneyBoxes] = await Promise.allSettled([
      getBalance(),
      getMovements(50),
      getRecentPayments(20),
      getMoneyBoxes(),
    ]);

    return NextResponse.json({
      balance: balance.status === "fulfilled" ? balance.value : null,
      movements: movementsData.status === "fulfilled" ? movementsData.value.results : [],
      movementsTotal: movementsData.status === "fulfilled" ? movementsData.value.total : 0,
      recentPayments: recentPayments.status === "fulfilled" ? recentPayments.value : [],
      moneyBoxes: moneyBoxes.status === "fulfilled" ? moneyBoxes.value : [],
      errors: {
        balance: balance.status === "rejected" ? balance.reason?.message : null,
        movements: movementsData.status === "rejected" ? movementsData.reason?.message : null,
        payments: recentPayments.status === "rejected" ? recentPayments.reason?.message : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
