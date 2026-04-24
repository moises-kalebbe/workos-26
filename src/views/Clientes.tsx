"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronRight,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/dbClient";
import { PageHeader } from "@/components/system/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  notes: string;
};

type ClientFileMeta = {
  id: string;
  client_id: string;
  file_name: string;
  file_size: number;
  service_date: string;
  service_type: string;
  created_at: string;
};

const EMPTY_FORM: ClientForm = { name: "", email: "", phone: "", notes: "" };

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [allFiles, setAllFiles] = useState<ClientFileMeta[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [search, setSearch] = useState("");

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db
        .from("clients")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      setClients((data as unknown as Client[]) ?? []);
    } catch (err) {
      toast.error("Erro ao carregar clientes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await db
        .from("client_files")
        .select("id,client_id,file_name,file_size,service_date,service_type,created_at")
        .order("service_date", { ascending: false });
      if (error) throw new Error(error.message);
      setAllFiles((data as unknown as ClientFileMeta[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar arquivos:", err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
    void loadFiles();
  }, [loadClients, loadFiles]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStr = format(now, "yyyy-MM");
    const lastMonthStr = format(subMonths(now, 1), "yyyy-MM");
    const currentMonthLabel = format(now, "MMMM/yyyy", { locale: ptBR });
    const lastMonthLabel = format(subMonths(now, 1), "MMMM", { locale: ptBR });

    const thisMonthFiles = allFiles.filter((f) => f.service_date.startsWith(currentMonthStr));
    const lastMonthFiles = allFiles.filter((f) => f.service_date.startsWith(lastMonthStr));

    const activeClientsThisMonth = new Set(thisMonthFiles.map((f) => f.client_id)).size;

    const countByClientId = thisMonthFiles.reduce<Record<string, number>>((acc, f) => {
      acc[f.client_id] = (acc[f.client_id] ?? 0) + 1;
      return acc;
    }, {});

    const topClientId = Object.entries(countByClientId).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topClient = topClientId ? clients.find((c) => c.id === topClientId) : null;
    const topClientCount = topClientId ? (countByClientId[topClientId] ?? 0) : 0;

    const trend =
      lastMonthFiles.length === 0
        ? null
        : Math.round(((thisMonthFiles.length - lastMonthFiles.length) / lastMonthFiles.length) * 100);

    return {
      totalClients: clients.length,
      thisMonthCount: thisMonthFiles.length,
      activeClientsThisMonth,
      topClient,
      topClientCount,
      trend,
      currentMonthLabel,
      lastMonthLabel,
    };
  }, [allFiles, clients]);

  function openCreate() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(client: Client, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      notes: client.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const values = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingClient) {
        const { error } = await db.from("clients").update(values).eq("id", editingClient.id);
        if (error) throw new Error(error.message);
        toast.success("Cliente atualizado");
      } else {
        const { error } = await db.from("clients").insert(values);
        if (error) throw new Error(error.message);
        toast.success("Cliente criado");
      }

      setDialogOpen(false);
      await loadClients();
    } catch (err) {
      toast.error("Erro ao salvar cliente");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(client: Client) {
    try {
      const { error } = await db.from("clients").delete().eq("id", client.id);
      if (error) throw new Error(error.message);
      toast.success("Cliente excluído");
      setDeleteTarget(null);
      await loadClients();
    } catch (err) {
      toast.error("Erro ao excluir cliente");
      console.error(err);
    }
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const insightText = (() => {
    if (loadingFiles) return null;
    const { thisMonthCount, activeClientsThisMonth, currentMonthLabel, trend, lastMonthLabel } = stats;

    if (thisMonthCount === 0) {
      return `Nenhum arquivo entregue em ${currentMonthLabel} ainda. Hora de registrar os serviços do mês.`;
    }

    const base = `Em ${currentMonthLabel} você entregou ${thisMonthCount} ${thisMonthCount === 1 ? "arquivo" : "arquivos"} para ${activeClientsThisMonth} ${activeClientsThisMonth === 1 ? "cliente" : "clientes"}.`;

    if (trend === null) return base;
    if (trend > 0) return `${base} ↑ ${trend}% a mais que ${lastMonthLabel}.`;
    if (trend < 0) return `${base} ↓ ${Math.abs(trend)}% a menos que ${lastMonthLabel}.`;
    return `${base} Mesmo volume que ${lastMonthLabel}.`;
  })();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes e arquivos de serviços realizados"
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      {/* Dashboard */}
      {loadingFiles ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Total clientes */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.totalClients}</p>
            <p className="text-xs text-muted-foreground">clientes cadastrados</p>
          </div>

          {/* Arquivos este mês */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Este mês</p>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-foreground">{stats.thisMonthCount}</p>
              {stats.trend !== null && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    stats.trend > 0 ? "text-success-foreground" : stats.trend < 0 ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {stats.trend > 0 ? `↑ ${stats.trend}%` : stats.trend < 0 ? `↓ ${Math.abs(stats.trend)}%` : "= igual"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">arquivos entregues</p>
          </div>

          {/* Clientes ativos */}
          <div className="rounded-xl border border-info/20 bg-info-muted p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-info" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ativos</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{stats.activeClientsThisMonth}</p>
            <p className="text-xs text-muted-foreground">clientes com entrega no mês</p>
          </div>

          {/* Top cliente */}
          <div className="rounded-xl border border-warning/20 bg-warning-muted p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Top cliente</p>
            </div>
            {stats.topClient ? (
              <>
                <p className="mt-2 truncate text-lg font-semibold text-foreground">{stats.topClient.name}</p>
                <p className="text-xs text-muted-foreground">{stats.topClientCount} {stats.topClientCount === 1 ? "arquivo" : "arquivos"} este mês</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-semibold text-foreground">—</p>
                <p className="text-xs text-muted-foreground">sem entregas este mês</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Insight sentence */}
      {insightText && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          {insightText}
        </div>
      )}

      {/* Search */}
      <div className="max-w-xs">
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">
            {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => router.push(`/clientes/${client.id}`)}
              className={cn(
                "group flex items-center justify-between rounded-2xl border border-border bg-card/80 p-4 text-left",
                "transition-colors hover:border-primary/50 hover:bg-card",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{client.name}</p>
                {client.email && (
                  <p className="truncate text-sm text-muted-foreground">{client.email}</p>
                )}
                {client.phone && !client.email && (
                  <p className="truncate text-sm text-muted-foreground">{client.phone}</p>
                )}
              </div>
              <div className="ml-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => openEdit(client, e)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(client);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Lu Burger"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="contato@cliente.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas sobre o cliente..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingClient ? "Salvar alterações" : "Criar cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {deleteTarget && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
          itemLabel={`"${deleteTarget.name}"`}
        />
      )}
    </div>
  );
}
