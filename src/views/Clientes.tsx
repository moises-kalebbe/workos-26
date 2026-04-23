"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
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

const EMPTY_FORM: ClientForm = { name: "", email: "", phone: "", notes: "" };

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

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
