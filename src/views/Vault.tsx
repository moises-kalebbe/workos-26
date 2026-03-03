import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Lock, Eye, EyeOff, Copy, Search, Trash2, Pencil, ChevronRight, Link2, UserRound, NotebookPen, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { FilterBar } from "@/components/system/filter-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import type { VaultEntry, Project } from "@/types";

type MetaFilter = "all" | "with-url" | "without-url" | "with-user" | "with-notes";
type SortOption = "updated_desc" | "updated_asc" | "service_asc" | "service_desc";

export default function VaultPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [metaFilter, setMetaFilter] = useState<MetaFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] = useState<VaultEntry | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

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
      setExpandedEntries((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function toggleGroup(client: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(client)) {
        next.delete(client);
      } else {
        next.add(client);
      }
      return next;
    });
  }

  function toggleEntryDetails(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setCompanyFilter("all");
    setMetaFilter("all");
    setSortBy("updated_desc");
    setCollapsedGroups(new Set());
  }

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const getCompanyLabel = useCallback(
    (entry: VaultEntry) =>
      (entry.project_id ? projectMap.get(entry.project_id)?.name : null) ||
      entry.client ||
      "Conhecimento geral",
    [projectMap]
  );

  const companyOptions = useMemo(
    () => Array.from(new Set(entries.map((entry) => getCompanyLabel(entry)))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [entries, getCompanyLabel]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const companyLabel = getCompanyLabel(entry);
      if (companyFilter !== "all" && companyLabel !== companyFilter) return false;

      if (metaFilter === "with-url" && !entry.url) return false;
      if (metaFilter === "without-url" && entry.url) return false;
      if (metaFilter === "with-user" && !entry.username) return false;
      if (metaFilter === "with-notes" && !entry.notes) return false;

      if (!term) return true;

      const haystack = [
        companyLabel,
        entry.service || "",
        entry.username || "",
        entry.url || "",
        entry.notes || "",
      ].join(" ").toLowerCase();

      return haystack.includes(term);
    });
  }, [entries, search, companyFilter, metaFilter, getCompanyLabel]);

  const sorted = useMemo(() => {
    const list = [...filtered];

    list.sort((a, b) => {
      if (sortBy === "service_asc" || sortBy === "service_desc") {
        const comp = (a.service || "").localeCompare((b.service || ""), "pt-BR");
        return sortBy === "service_asc" ? comp : -comp;
      }

      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      if (sortBy === "updated_asc") return dateA - dateB;
      return dateB - dateA;
    });

    return list;
  }, [filtered, sortBy]);

  const grouped = useMemo(
    () =>
      sorted.reduce<Record<string, VaultEntry[]>>((acc, entry) => {
        const companyLabel = getCompanyLabel(entry);
        if (!acc[companyLabel]) acc[companyLabel] = [];
        acc[companyLabel].push(entry);
        return acc;
      }, {}),
    [sorted, getCompanyLabel]
  );

  const groupedEntries = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
    [grouped]
  );

  const hasActiveFilters =
    !!search.trim() || companyFilter !== "all" || metaFilter !== "all" || sortBy !== "updated_desc";

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <PageHeader
        title="Cofre"
        description="Vista compacta com filtros para localizar credenciais mais rapido."
        actions={(
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
        )}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Editar Credencial</DialogTitle>
          </DialogHeader>
          {renderCredentialForm(editProjectValue, setEditProjectValue, editService, setEditService, editUrl, setEditUrl, editUsername, setEditUsername, editPassword, setEditPassword, editNotes, setEditNotes, updateEntry, "Salvar Alteracoes")}
        </DialogContent>
      </Dialog>

      <FilterBar className="gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, servico, usuario, url ou nota..."
            className="pl-10 bg-background border-border"
          />
        </div>

        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full bg-background border-border sm:w-[220px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {companyOptions.map((company) => (
              <SelectItem key={company} value={company}>{company}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={metaFilter} onValueChange={(value) => setMetaFilter(value as MetaFilter)}>
          <SelectTrigger className="w-full bg-background border-border sm:w-[220px]">
            <SelectValue placeholder="Filtro rapido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="with-url">Com URL</SelectItem>
            <SelectItem value="without-url">Sem URL</SelectItem>
            <SelectItem value="with-user">Com usuario</SelectItem>
            <SelectItem value="with-notes">Com notas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
          <SelectTrigger className="w-full bg-background border-border sm:w-[220px]">
            <SelectValue placeholder="Ordenacao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Atualizacao (mais recente)</SelectItem>
            <SelectItem value="updated_asc">Atualizacao (mais antiga)</SelectItem>
            <SelectItem value="service_asc">Servico (A-Z)</SelectItem>
            <SelectItem value="service_desc">Servico (Z-A)</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={clearFilters} className="gap-2 border-border">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-secondary/70 text-secondary-foreground">
            {sorted.length} credenciais
          </Badge>
          <Badge variant="secondary" className="bg-secondary/70 text-secondary-foreground">
            {groupedEntries.length} empresas
          </Badge>
          {hasActiveFilters ? (
            <Badge variant="outline" className="border-primary/30 text-primary">Filtros ativos</Badge>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => setCollapsedGroups(new Set(groupedEntries.map(([company]) => company)))}
            disabled={groupedEntries.length === 0}
          >
            Recolher tudo
          </Button>
          <Button
            variant="outline"
            className="border-border"
            onClick={() => setCollapsedGroups(new Set())}
            disabled={groupedEntries.length === 0}
          >
            Expandir tudo
          </Button>
        </div>
      </div>

      {/* Entries */}
      {groupedEntries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">Nenhuma credencial encontrada</p>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "Ajuste os filtros para ampliar o resultado." : "Adicione credenciais para manter tudo organizado."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedEntries.map(([client, clientEntries]) => {
            const isCollapsed = collapsedGroups.has(client);

            return (
              <div key={client} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(client)}
                  className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left hover:bg-background/60"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                    <h3 className="text-sm font-semibold text-foreground">{client}</h3>
                  </div>
                  <Badge variant="secondary" className="bg-primary/15 text-primary">{clientEntries.length}</Badge>
                </button>

                {!isCollapsed ? (
                  <div className="divide-y divide-border">
                    {clientEntries.map((entry) => {
                      const isVisible = visiblePasswords.has(entry.id);
                      const isExpanded = expandedEntries.has(entry.id);
                      const password = decodePassword(entry.encrypted_password);

                      return (
                        <div key={entry.id} className="px-4 py-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium text-foreground">{entry.service || "Sem servico"}</p>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                {entry.url ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5">
                                    <Link2 className="h-3 w-3" />
                                    URL
                                  </span>
                                ) : null}
                                {entry.username ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5">
                                    <UserRound className="h-3 w-3" />
                                    Usuario
                                  </span>
                                ) : null}
                                {entry.notes ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5">
                                    <NotebookPen className="h-3 w-3" />
                                    Notas
                                  </span>
                                ) : null}
                              </div>
                              {entry.url ? (
                                <a href={entry.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary hover:underline">
                                  {entry.url}
                                </a>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => togglePassword(entry.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(password)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {entry.username ? (
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(entry.username)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                  <UserRound className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                              <Button variant="ghost" onClick={() => toggleEntryDetails(entry.id)} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                                {isExpanded ? "Ocultar" : "Detalhes"}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(entry)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setEntryPendingDelete(entry)} className="h-8 w-8 text-muted-foreground hover:text-danger">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2 rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                            Senha: <span className="font-mono text-foreground">{isVisible ? password : "********"}</span>
                          </div>

                          {isExpanded ? (
                            <div className="mt-2 grid gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                              {entry.username ? (
                                <div>
                                  Usuario: <span className="font-mono text-foreground">{entry.username}</span>
                                </div>
                              ) : null}
                              {entry.notes ? (
                                <div>Notas: <span className="text-foreground">{entry.notes}</span></div>
                              ) : null}
                              <div>Atualizado: <span className="text-foreground">{formatDate(entry.updated_at || entry.created_at)}</span></div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}





