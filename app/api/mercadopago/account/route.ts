import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  extractCofrinhos,
  getBalance,
  getMovements,
  getMoneyBoxes,
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
    const [balanceResult, paymentsResult, movementsResult, moneyBoxesResult] = await Promise.allSettled([
      getBalance(),
      getRecentPayments(50),
      getMovements(50),
      getMoneyBoxes(),
    ]);

    const payments = paymentsResult.status === "fulfilled" ? paymentsResult.value : [];
    const cofrinhos = extractCofrinhos(payments);

    return NextResponse.json({
      balance: balanceResult.status === "fulfilled" ? balanceResult.value : null,
      recentPayments: payments,
      cofrinhos,
      movements: movementsResult.status === "fulfilled" ? movementsResult.value.results : [],
      movementsTotal: movementsResult.status === "fulfilled" ? movementsResult.value.total : 0,
      moneyBoxes: moneyBoxesResult.status === "fulfilled" ? moneyBoxesResult.value : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
