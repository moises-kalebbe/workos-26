"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  PiggyBank,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MpAccountData, MpCofrinho, MpPayment } from "@/integrations/mercadopago/types";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: MpAccountData };

function formatMpDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function PaymentRow({ p }: { p: MpPayment }) {
  const isApproved = p.status === "approved";
  const cofrinho = p.amounts?.collector?.transaction_destination?.subpartition?.name;
  const label = cofrinho ? `Cofrinho: ${cofrinho}` : (p.description || `Pagamento #${p.id}`);
  const isIn = p.operation_type === "regular_payment";

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("shrink-0 rounded-full p-1", isIn ? "bg-info-muted text-info" : "bg-muted text-muted-foreground")}>
          {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm truncate">{label}</p>
          <p className="text-xs text-muted-foreground">{formatMpDate(p.date_created)}</p>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1">
        <span className="text-sm font-medium tabular-nums">{formatMoney(p.transaction_amount)}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-caption h-4 px-1",
            isApproved ? "border-info/40 text-info" : "border-warning/40 text-warning-foreground",
          )}
        >
          {isApproved ? "aprovado" : p.status}
        </Badge>
      </div>
    </div>
  );
}

function CofrinhoCard({ box }: { box: MpCofrinho }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{box.name}</span>
        <PiggyBank size={16} className="text-muted-foreground shrink-0" />
      </div>
      <p className="text-xl font-bold tabular-nums">{formatMoney(box.amount)}</p>
    </div>
  );
}

export function MercadoPagoWidget() {
  const [state, setState] = useState<FetchState>({ status: "idle" });

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
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adicione seu token de acesso pessoal ao arquivo{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code>.
            </p>
            <div className="rounded-lg bg-muted/60 p-4 font-mono text-xs">
              MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
            </div>
            <p className="text-sm text-muted-foreground">
              Obtenha seu token em{" "}
              <a
                href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
              >
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

  const { cofrinhos, recentPayments } = state.data;
  const totalCofrinhos = cofrinhos.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Resumo cofrinhos */}
      {cofrinhos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PiggyBank size={16} /> Cofrinhos ({cofrinhos.length})
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp size={13} />
              Total:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatMoney(totalCofrinhos)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cofrinhos.map((box) => (
              <CofrinhoCard key={box.name} box={box} />
            ))}
          </div>
        </div>
      )}

      {/* Pagamentos */}
      <Card className="rounded-2xl border-border bg-card/95">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              Pagamentos recentes ({recentPayments.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs h-8">
              <RefreshCw size={13} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum pagamento encontrado.
            </p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto pr-1">
              {recentPayments.map((p) => (
                <PaymentRow key={p.id} p={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
