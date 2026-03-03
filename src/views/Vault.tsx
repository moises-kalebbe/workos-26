import { useState, useEffect, useMemo } from "react";
import { Plus, Lock, Eye, EyeOff, Copy, Search, Loader2, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { toast } from "sonner";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
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
  const [entryPendingDelete, setEntryPendingDelete] = useState<VaultEntry | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Form
  const [newProjectValue, setNewProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [newService, setNewService] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit form
  const [editProjectValue, setEditProjectValue] = useState(GENERAL_PROJECT_VALUE);
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
    if (!newPassword || !user) return;
    const projectId = projectIdFromSelectValue(newProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const encoded = btoa(newPassword);
    const iv = crypto.randomUUID();

    const { error } = await supabase.from("vault_entries").insert({
      user_id: user.id,
      project_id: projectId,
      client: selectedProject?.name || null,
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
    if (!editingEntry || !editPassword) return;
    const projectId = projectIdFromSelectValue(editProjectValue);
    const selectedProject = projects.find((project) => project.id === projectId) || null;
    const encoded = btoa(editPassword);

    const { error } = await supabase.from("vault_entries").update({
      project_id: projectId,
      client: selectedProject?.name || null,
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
      toast.success("Credencial excluida!");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function openEditDialog(entry: VaultEntry) {
    const matchedProjectId =
      entry.project_id ||
      projects.find((project) => project.name === entry.client || project.client === entry.client)?.id ||
      null;

    setEditingEntry(entry);
    setEditProjectValue(projectSelectValue(matchedProjectId));
    setEditService(entry.service || "");
    setEditUrl(entry.url || "");
    setEditUsername(entry.username || "");
    setEditPassword(decodePassword(entry.encrypted_password));
    setEditNotes(entry.notes || "");
    setEditDialogOpen(true);
  }

  function resetForm() {
    setNewProjectValue(GENERAL_PROJECT_VALUE);
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

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const getCompanyLabel = (entry: VaultEntry) =>
    (entry.project_id ? projectMap.get(entry.project_id)?.name : null) ||
    entry.client ||
    "Conhecimento geral";

  const filtered = entries.filter(
    (e) =>
      getCompanyLabel(e).toLowerCase().includes(search.toLowerCase()) ||
      (e.service || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, VaultEntry[]>>((acc, entry) => {
    const companyLabel = getCompanyLabel(entry);
    if (!acc[companyLabel]) acc[companyLabel] = [];
    acc[companyLabel].push(entry);
    return acc;
  }, {});

  function renderCredentialForm(
    projectValue: string, setProjectValue: (v: string) => void,
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
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Select value={projectValue} onValueChange={setProjectValue}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Conhecimento geral" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_PROJECT_VALUE}>Conhecimento geral</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Servico</Label>
            <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Gmail, AWS..." className="bg-background border-border" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Usuario</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario@email.com" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="bg-background border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Notas</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes..." className="bg-background border-border" />
        </div>
        <Button onClick={onSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {buttonLabel}
        </Button>
      </div>
    );
  }

  if (loading) {
    return <LoadingState message="Carregando cofre..." />;
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        open={!!entryPendingDelete}
        onOpenChange={(open) => {
          if (!open) setEntryPendingDelete(null);
        }}
        itemLabel={`a credencial "${entryPendingDelete?.service || "selecionada"}"`}
        onConfirm={async () => {
          if (!entryPendingDelete) return;
          await deleteEntry(entryPendingDelete.id);
          setEntryPendingDelete(null);
        }}
      />

      <div className="flex items-center justify-between">
        <PageHeader className="flex-1" title="Cofre" description="Credenciais organizadas por empresa e servico." />
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
            {renderCredentialForm(newProjectValue, setNewProjectValue, newService, setNewService, newUrl, setNewUrl, newUsername, setNewUsername, newPassword, setNewPassword, newNotes, setNewNotes, createEntry, "Salvar Credencial")}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Credencial</DialogTitle>
          </DialogHeader>
          {renderCredentialForm(editProjectValue, setEditProjectValue, editService, setEditService, editUrl, setEditUrl, editUsername, setEditUsername, editPassword, setEditPassword, editNotes, setEditNotes, updateEntry, "Salvar Alteracoes")}
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou servico..." className="pl-10 bg-card border-border" />
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
                          <p className="text-sm font-medium text-foreground">{entry.service || "Sem servico"}</p>
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
                          <button onClick={() => setEntryPendingDelete(entry)} className="p-1.5 text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {entry.username && (
                        <div className="flex items-center justify-between rounded-lg bg-background p-2">
                          <span className="text-xs text-muted-foreground">Usuario: <span className="text-foreground font-mono">{entry.username}</span></span>
                          <button onClick={() => copyToClipboard(entry.username!)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg bg-background p-2">
                        <span className="text-xs text-muted-foreground">
                          Senha: <span className="text-foreground font-mono">{isVisible ? password : "********"}</span>
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





