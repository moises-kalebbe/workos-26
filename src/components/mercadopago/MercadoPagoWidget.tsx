"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ExternalLink,
  Loader2,
  PiggyBank,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MpAccountData, MpMoneyBox, MpMovement, MpPayment } from "@/integrations/mercadopago/types";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: MpAccountData };

function formatMpDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function MovementRow({ m }: { m: MpMovement }) {
  const isIn = m.amount >= 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("shrink-0 rounded-full p-1", isIn ? "bg-info-muted text-info" : "bg-warning-muted text-warning-foreground")}>
          {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm truncate">{m.description || m.action || m.type}</p>
          <p className="text-xs text-muted-foreground">{formatMpDate(m.date)}</p>
        </div>
      </div>
      <span className={cn("text-sm font-medium tabular-nums shrink-0", isIn ? "text-info" : "text-warning-foreground")}>
        {isIn ? "+" : ""}{formatMoney(m.amount)}
      </span>
    </div>
  );
}

function PaymentRow({ p }: { p: MpPayment }) {
  const isApproved = p.status === "approved";
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-sm truncate">{p.description || `Pagamento #${p.id}`}</p>
          <p className="text-xs text-muted-foreground">{formatMpDate(p.date_created)}</p>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1">
        <span className="text-sm font-medium tabular-nums">{formatMoney(p.transaction_amount)}</span>
        <Badge variant="outline" className={cn("text-caption h-4 px-1", isApproved ? "border-info/40 text-info" : "border-warning/40 text-warning-foreground")}>
          {isApproved ? "aprovado" : p.status}
        </Badge>
      </div>
    </div>
  );
}

function MoneyBoxCard({ box }: { box: MpMoneyBox }) {
  const pct = box.goal_amount ? Math.min(100, (box.current_amount / box.goal_amount) * 100) : null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{box.name}</span>
        <PiggyBank size={16} className="text-muted-foreground shrink-0" />
      </div>
      <p className="text-xl font-bold tabular-nums">{formatMoney(box.current_amount)}</p>
      {box.goal_amount && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Meta: {formatMoney(box.goal_amount)} ({pct?.toFixed(0)}%)</p>
        </div>
      )}
    </div>
  );
}

export function MercadoPagoWidget() {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [activeSection, setActiveSection] = useState<"movimentos" | "pagamentos">("movimentos");

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/mercadopago/account");
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        if (res.status === 503) {
          setState({ status: "error", message: "token_missing" });
        } else {
          setState({ status: "error", message: body.error ?? "Erro ao carregar dados" });
        }
        return;
      }
      const data = await res.json();
      setState({ status: "ok", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro de rede" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Carregando dados do Mercado Pago…</span>
      </div>
    );
  }

  if (state.status === "error") {
    if (state.message === "token_missing") {
      return (
        <Card className="rounded-2xl border-border bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle size={18} className="text-warning-foreground" />
              Configuração necessária
            </CardTitle>
            <CardDescription>
              Para conectar sua conta do Mercado Pago, adicione seu token de acesso pessoal ao arquivo <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/60 p-4 font-mono text-xs">
              MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
            </div>
            <p className="text-sm text-muted-foreground">
              Obtenha seu token em{" "}
              <a href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1">
                mercadopago.com.br/developers <ExternalLink size={12} />
              </a>
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <AlertCircle size={20} className="text-danger-foreground" />
        <p className="text-sm text-center">{state.message}</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} /> Tentar novamente
        </Button>
      </div>
    );
  }

  const { balance, movements, recentPayments, moneyBoxes } = state.data;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Saldo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-border bg-card/95">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Wallet size={14} /> Saldo disponível
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {balance ? formatMoney(balance.available_balance) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border bg-card/95">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Banknote size={14} /> Saldo total
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {balance ? formatMoney(balance.total_amount) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border bg-card/95">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <AlertCircle size={14} /> Indisponível
            </div>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">
              {balance ? formatMoney(balance.unavailable_balance) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cofrinhos */}
      {moneyBoxes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PiggyBank size={16} /> Cofrinhos ({moneyBoxes.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moneyBoxes.map((box) => (
              <MoneyBoxCard key={box.id} box={box} />
            ))}
          </div>
        </div>
      )}

      {/* Movimentos / Pagamentos */}
      <Card className="rounded-2xl border-border bg-card/95">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
              <button
                onClick={() => setActiveSection("movimentos")}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeSection === "movimentos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Extrato ({movements.length})
              </button>
              <button
                onClick={() => setActiveSection("pagamentos")}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeSection === "pagamentos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Cobranças ({recentPayments.length})
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs h-8">
              <RefreshCw size={13} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {activeSection === "movimentos" && (
            movements.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum movimento encontrado.</p>
              : <div className="max-h-[480px] overflow-y-auto pr-1 space-y-0">
                  {movements.map((m) => <MovementRow key={m.id} m={m} />)}
                </div>
          )}
          {activeSection === "pagamentos" && (
            recentPayments.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cobrança encontrada.</p>
              : <div className="max-h-[480px] overflow-y-auto pr-1 space-y-0">
                  {recentPayments.map((p) => <PaymentRow key={p.id} p={p} />)}
                </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
