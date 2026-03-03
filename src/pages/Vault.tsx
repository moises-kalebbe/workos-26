import { useState, useEffect } from "react";
import { Plus, Lock, Eye, EyeOff, Copy, Search, Loader2, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { VaultEntry, Project } from "@/types";

export default function VaultPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Form
  const [newClient, setNewClient] = useState("");
  const [newService, setNewService] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit form
  const [editClient, setEditClient] = useState("");
  const [editService, setEditService] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [entriesRes, projRes] = await Promise.all([
      supabase.from("vault_entries").select("*").order("client"),
      supabase.from("projects").select("*").order("name"),
    ]);
    setEntries((entriesRes.data || []) as unknown as VaultEntry[]);
    setProjects((projRes.data || []) as unknown as Project[]);
    setLoading(false);
  }

  async function createEntry() {
    if (!newClient || !newPassword || !user) return;
    const encoded = btoa(newPassword);
    const iv = crypto.randomUUID();

    const { error } = await supabase.from("vault_entries").insert({
      user_id: user.id,
      client: newClient,
      service: newService || null,
      url: newUrl || null,
      username: newUsername || null,
      encrypted_password: encoded,
      iv,
      notes: newNotes || null,
    });

    if (error) {
      toast.error("Erro ao salvar credencial");
    } else {
      toast.success("Credencial salva!");
      setDialogOpen(false);
      resetForm();
      loadData();
    }
  }

  async function updateEntry() {
    if (!editingEntry || !editClient || !editPassword) return;
    const encoded = btoa(editPassword);

    const { error } = await supabase.from("vault_entries").update({
      client: editClient,
      service: editService || null,
      url: editUrl || null,
      username: editUsername || null,
      encrypted_password: encoded,
      notes: editNotes || null,
    }).eq("id", editingEntry.id);

    if (error) {
      toast.error("Erro ao atualizar credencial");
    } else {
      toast.success("Credencial atualizada!");
      setEditDialogOpen(false);
      setEditingEntry(null);
      loadData();
    }
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from("vault_entries").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir credencial");
    } else {
      toast.success("Credencial excluída!");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function openEditDialog(entry: VaultEntry) {
    setEditingEntry(entry);
    setEditClient(entry.client || "");
    setEditService(entry.service || "");
    setEditUrl(entry.url || "");
    setEditUsername(entry.username || "");
    setEditPassword(decodePassword(entry.encrypted_password));
    setEditNotes(entry.notes || "");
    setEditDialogOpen(true);
  }

  function resetForm() {
    setNewClient("");
    setNewService("");
    setNewUrl("");
    setNewUsername("");
    setNewPassword("");
    setNewNotes("");
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setTimeout(() => {
          setVisiblePasswords((p) => { const n = new Set(p); n.delete(id); return n; });
        }, 30000);
      }
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  function decodePassword(encoded: string) {
    try { return atob(encoded); } catch { return "***"; }
  }

  const filtered = entries.filter(
    (e) =>
      (e.client || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.service || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, VaultEntry[]>>((acc, entry) => {
    const clientKey = entry.client || "Sem cliente";
    if (!acc[clientKey]) acc[clientKey] = [];
    acc[clientKey].push(entry);
    return acc;
  }, {});

  function renderCredentialForm(
    client: string, setClient: (v: string) => void,
    service: string, setService: (v: string) => void,
    url: string, setUrl: (v: string) => void,
    username: string, setUsername: (v: string) => void,
    password: string, setPassword: (v: string) => void,
    notes: string, setNotes: (v: string) => void,
    onSubmit: () => void,
    buttonLabel: string
  ) {
    return (
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Empresa *</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Serviço</Label>
            <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Gmail, AWS..." className="bg-background border-border" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Usuário</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario@email.com" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Notas</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações..." className="bg-background border-border" />
        </div>
        <Button onClick={onSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {buttonLabel}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cofre</h1>
          <p className="text-sm text-muted-foreground">Credenciais organizadas por cliente</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Nova Credencial
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Nova Credencial</DialogTitle>
            </DialogHeader>
            {renderCredentialForm(newClient, setNewClient, newService, setNewService, newUrl, setNewUrl, newUsername, setNewUsername, newPassword, setNewPassword, newNotes, setNewNotes, createEntry, "Salvar Credencial")}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Credencial</DialogTitle>
          </DialogHeader>
          {renderCredentialForm(editClient, setEditClient, editService, setEditService, editUrl, setEditUrl, editUsername, setEditUsername, editPassword, setEditPassword, editNotes, setEditNotes, updateEntry, "Salvar Alterações")}
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou serviço..." className="pl-10 bg-card border-border" />
      </div>

      {/* Entries */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">Cofre vazio</p>
          <p className="text-sm text-muted-foreground">Adicione credenciais para manter tudo organizado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([client, entries]) => (
            <div key={client} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{client}</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {entries.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {entries.map((entry) => {
                  const isVisible = visiblePasswords.has(entry.id);
                  const password = decodePassword(entry.encrypted_password);

                  return (
                    <div key={entry.id} className="px-5 py-4 space-y-2 group">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.service || "Sem serviço"}</p>
                          {entry.url && (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              {entry.url}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditDialog(entry)} className="p-1.5 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteEntry(entry.id)} className="p-1.5 text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {entry.username && (
                        <div className="flex items-center justify-between rounded-lg bg-background p-2">
                          <span className="text-xs text-muted-foreground">Usuário: <span className="text-foreground font-mono">{entry.username}</span></span>
                          <button onClick={() => copyToClipboard(entry.username!)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg bg-background p-2">
                        <span className="text-xs text-muted-foreground">
                          Senha: <span className="text-foreground font-mono">{isVisible ? password : "••••••••"}</span>
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => togglePassword(entry.id)} className="text-muted-foreground hover:text-foreground p-1">
                            {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(password)} className="text-muted-foreground hover:text-foreground p-1">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-muted-foreground">{entry.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
