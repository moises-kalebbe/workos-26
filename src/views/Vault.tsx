"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, Download, ExternalLink, Eye, EyeOff, FolderOpen, Import, Loader2, Pencil, Plus, RefreshCcw, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { db as clientDb } from "@/lib/dbClient";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GENERAL_PROJECT_DESCRIPTION, GENERAL_PROJECT_LABEL, GENERAL_PROJECT_VALUE, projectIdFromSelectValue, projectSelectValue } from "@/config/constants";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { decodeBrowserSecret, encodeBrowserSecret, getInitialTab, type VaultEnvironmentEntryRecord, type VaultGithubConnectionRecord, type VaultHubTab, type VaultRepositoryRecord, type VaultSyncRunRecord, type WindowsNoteSourceDetection } from "@/lib/vaultHub";
import type { Project, VaultEntry } from "@/types";

type CompanyFolder = { id: string; label: string; description: string; projectId: string | null };
type CredentialFormState = { service: string; url: string; username: string; password: string; notes: string; projectValue: string };
type GithubConnectionFormState = { displayName: string; token: string };
type VaultCredentialTransferItem = { service: string; url: string; username: string; password: string; notes: string };
type VaultCredentialTransferPayload = {
  version: 1;
  exportedAt: string;
  sourceCompany: string;
  credentials: VaultCredentialTransferItem[];
};

const EMPTY_CREDENTIAL_FORM: CredentialFormState = { service: "", url: "", username: "", password: "", notes: "", projectValue: GENERAL_PROJECT_VALUE };
const EMPTY_GITHUB_CONNECTION_FORM: GithubConnectionFormState = { displayName: "GitHub principal", token: "" };

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function splitImportedNotes(rawContent: string) {
  return rawContent.split(/\n---\n/g).map((item) => item.trim()).filter(Boolean);
}

function inCompany(projectId: string | null) {
  return projectId || GENERAL_PROJECT_VALUE;
}

function EmptyState({ message }: { message: string }) {
  return <Card className="border-dashed border-border/70 bg-card/50"><CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent></Card>;
}

function normalizeCredentialField(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function isVaultCredentialTransferPayload(value: unknown): value is VaultCredentialTransferPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<VaultCredentialTransferPayload>;
  if (payload.version !== 1 || typeof payload.exportedAt !== "string" || typeof payload.sourceCompany !== "string" || !Array.isArray(payload.credentials)) {
    return false;
  }

  return payload.credentials.every((item) => {
    if (!item || typeof item !== "object") return false;
    const credential = item as Partial<VaultCredentialTransferItem>;
    return (
      typeof credential.service === "string" &&
      typeof credential.url === "string" &&
      typeof credential.username === "string" &&
      typeof credential.password === "string" &&
      typeof credential.notes === "string"
    );
  });
}

function buildCredentialTransferFileName(label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `vault-credentials-${slug || "cofre"}.json`;
}

export default function VaultPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCompany = searchParams?.get("company") || GENERAL_PROJECT_VALUE;
  const initialTab = getInitialTab(searchParams?.get("tab") || null);

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [repositories, setRepositories] = useState<VaultRepositoryRecord[]>([]);
  const [environmentEntries, setEnvironmentEntries] = useState<VaultEnvironmentEntryRecord[]>([]);
  const [syncRuns, setSyncRuns] = useState<VaultSyncRunRecord[]>([]);
  const [githubConnections, setGithubConnections] = useState<VaultGithubConnectionRecord[]>([]);
  const [windowsSources, setWindowsSources] = useState<WindowsNoteSourceDetection[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompany);
  const [activeTab, setActiveTab] = useState<VaultHubTab>(initialTab);
  const [search, setSearch] = useState("");
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<VaultEntry | null>(null);
  const [credentialForm, setCredentialForm] = useState<CredentialFormState>(EMPTY_CREDENTIAL_FORM);
  const [deleteCredential, setDeleteCredential] = useState<VaultEntry | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubConnectionForm, setGithubConnectionForm] = useState<GithubConnectionFormState>(EMPTY_GITHUB_CONNECTION_FORM);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [windowsSourceKey, setWindowsSourceKey] = useState("manual");
  const [windowsImportProjectValue, setWindowsImportProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [windowsImportTags, setWindowsImportTags] = useState("windows-import");
  const [windowsImportContent, setWindowsImportContent] = useState("");
  const credentialImportInputRef = useRef<HTMLInputElement | null>(null);

  async function authorizedFetch(input: string, init?: RequestInit) {
    const { data: { session } } = await clientDb.auth.getSession();
    const headers = new Headers(init?.headers || {});
    if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
    if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers });
  }

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [entriesRes, projectsRes, repositoriesRes, envsRes, syncRes, githubRes] = await Promise.all([
        clientDb.from("vault_entries").select("*").order("updated_at", { ascending: false }),
        clientDb.from("projects").select("*").order("name"),
        clientDb.from("vault_repositories").select("*").order("repo_name"),
        clientDb.from("vault_environment_entries").select("*").order("env_key"),
        clientDb.from("vault_sync_runs").select("*").order("created_at", { ascending: false }).limit(30),
        clientDb.from("vault_github_connections").select("*").order("updated_at", { ascending: false }),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (repositoriesRes.error) throw repositoriesRes.error;
      if (envsRes.error) throw envsRes.error;
      if (syncRes.error) throw syncRes.error;
      if (githubRes.error) throw githubRes.error;
      setVaultEntries((entriesRes.data || []) as VaultEntry[]);
      setProjects((projectsRes.data || []) as Project[]);
      setRepositories((repositoriesRes.data || []) as VaultRepositoryRecord[]);
      setEnvironmentEntries((envsRes.data || []) as VaultEnvironmentEntryRecord[]);
      setSyncRuns((syncRes.data || []) as VaultSyncRunRecord[]);
      setGithubConnections((githubRes.data || []) as VaultGithubConnectionRecord[]);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao carregar o Cofre.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    setSelectedCompanyId(searchParams?.get("company") || GENERAL_PROJECT_VALUE);
    setActiveTab(getInitialTab(searchParams?.get("tab") || null));
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.set("company", selectedCompanyId);
    next.set("tab", activeTab);
    const target = next.toString();
    if ((searchParams?.toString() || "") !== target) router.replace(`${pathname}?${target}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams, selectedCompanyId]);

  const searchTerm = search.trim().toLowerCase();
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const repositoryMap = useMemo(() => new Map(repositories.map((repository) => [repository.id, repository])), [repositories]);
  const folders = useMemo<CompanyFolder[]>(() => [{ id: GENERAL_PROJECT_VALUE, label: GENERAL_PROJECT_LABEL, description: GENERAL_PROJECT_DESCRIPTION, projectId: null }, ...projects.map((project) => ({ id: project.id, label: project.name, description: project.client || "Pasta operacional da empresa", projectId: project.id }))], [projects]);
  const selectedFolder = folders.find((folder) => folder.id === selectedCompanyId) || folders[0] || null;
  const activeGithubConnection = githubConnections.find((connection) => connection.is_active) || null;
  const importPreview = useMemo(() => splitImportedNotes(windowsImportContent), [windowsImportContent]);
  const filteredCredentials = vaultEntries.filter((entry) => inCompany(entry.project_id) === selectedCompanyId).filter((entry) => [entry.service, entry.url, entry.username, entry.notes, entry.client].join("\n").toLowerCase().includes(searchTerm));
  const filteredRepositories = repositories.filter((repository) => inCompany(repository.project_id) === selectedCompanyId).filter((repository) => [repository.repo_name, repository.owner_name, repository.remote_url, repository.local_path, repository.default_branch].join("\n").toLowerCase().includes(searchTerm));
  const filteredEnvironmentEntries = environmentEntries.filter((entry) => inCompany(entry.project_id) === selectedCompanyId).filter((entry) => [entry.env_key, entry.source_path, entry.detected_provider, entry.env_scope, entry.repository_id ? repositoryMap.get(entry.repository_id)?.repo_name : ""].join("\n").toLowerCase().includes(searchTerm));
  const filteredSyncRuns = syncRuns.filter((run) => inCompany(run.project_id) === selectedCompanyId).filter((run) => [run.run_type, run.summary, run.status].join("\n").toLowerCase().includes(searchTerm));
  const stats = { credentials: vaultEntries.filter((entry) => inCompany(entry.project_id) === selectedCompanyId).length, repositories: repositories.filter((entry) => inCompany(entry.project_id) === selectedCompanyId).length, environments: environmentEntries.filter((entry) => inCompany(entry.project_id) === selectedCompanyId).length, latestSync: filteredSyncRuns[0]?.created_at || null };

  function resetCredentialForm() { setEditingCredential(null); setCredentialForm({ ...EMPTY_CREDENTIAL_FORM, projectValue: selectedCompanyId }); }
  function toggleSecret(key: string) { setVisibleSecrets((current) => ({ ...current, [key]: !current[key] })); }

  async function copyToClipboard(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copiado.`); } catch { toast.error(`Nao foi possivel copiar ${label.toLowerCase()}.`); }
  }

  async function handleScan() {
    setScanBusy(true);
    try {
      const response = await authorizedFetch("/api/vault/scan", { method: "POST", body: JSON.stringify({ rootPath: "D:\\GitHub" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao escanear Git local.");
      setWindowsSources((payload.windowsNoteSources || []) as WindowsNoteSourceDetection[]);
      toast.success("Escaneamento local concluido.");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao escanear Git local.");
    } finally {
      setScanBusy(false);
    }
  }

  function openCredentialDialog(entry?: VaultEntry) {
    if (entry) setCredentialForm({ service: entry.service || "", url: entry.url || "", username: entry.username || "", password: decodeBrowserSecret(entry.encrypted_password), notes: entry.notes || "", projectValue: projectSelectValue(entry.project_id) });
    else resetCredentialForm();
    setEditingCredential(entry || null);
    setCredentialDialogOpen(true);
  }

  async function saveCredential() {
    if (!user) return;
    setMutating(true);
    try {
      const projectId = projectIdFromSelectValue(credentialForm.projectValue);
      const project = projectId ? projectMap.get(projectId) : null;
      const encoded = encodeBrowserSecret(credentialForm.password);
      const payload = { user_id: user.id, project_id: projectId, client: project?.name || null, service: credentialForm.service.trim() || null, url: credentialForm.url.trim() || null, username: credentialForm.username.trim() || null, encrypted_password: encoded.encrypted, iv: encoded.iv, notes: credentialForm.notes.trim() || null };
      const result = editingCredential ? await clientDb.from("vault_entries").update(payload).eq("id", editingCredential.id) : await clientDb.from("vault_entries").insert(payload);
      if (result.error) throw result.error;
      toast.success(editingCredential ? "Credencial atualizada." : "Credencial criada.");
      setCredentialDialogOpen(false);
      resetCredentialForm();
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar credencial.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteCredentialEntry() {
    if (!deleteCredential) return;
    setMutating(true);
    try {
      const result = await clientDb.from("vault_entries").delete().eq("id", deleteCredential.id);
      if (result.error) throw result.error;
      toast.success("Credencial excluida.");
      setDeleteCredential(null);
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao excluir credencial.");
    } finally {
      setMutating(false);
    }
  }

  function exportCredentials() {
    if (filteredCredentials.length === 0) {
      toast.error("Não ha credenciais para exportar nesta pasta.");
      return;
    }

    const payload: VaultCredentialTransferPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sourceCompany: selectedFolder?.label || GENERAL_PROJECT_LABEL,
      credentials: filteredCredentials.map((entry) => ({
        service: entry.service || "",
        url: entry.url || "",
        username: entry.username || "",
        password: decodeBrowserSecret(entry.encrypted_password),
        notes: entry.notes || "",
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildCredentialTransferFileName(payload.sourceCompany);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
    toast.success(`${payload.credentials.length} credencial(is) exportada(s).`);
  }

  function openCredentialImport() {
    credentialImportInputRef.current?.click();
  }

  async function importCredentials(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) {
      return;
    }

    setMutating(true);
    try {
      const rawContent = await file.text();
      const parsed = JSON.parse(rawContent) as unknown;

      if (!isVaultCredentialTransferPayload(parsed)) {
        throw new Error("Arquivo invalido para importacao de credenciais.");
      }

      const projectId = projectIdFromSelectValue(selectedCompanyId);
      const project = projectId ? projectMap.get(projectId) : null;
      const sourceLabel = parsed.sourceCompany.trim() || "origem desconhecida";
      const candidates = parsed.credentials.filter((item) =>
        [item.service, item.url, item.username, item.password, item.notes].some((value) => value.trim().length > 0),
      );

      if (candidates.length === 0) {
        throw new Error("O arquivo não possui credenciais para importar.");
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of candidates) {
        const encoded = encodeBrowserSecret(item.password);
        const existing = vaultEntries.find((entry) =>
          inCompany(entry.project_id) === selectedCompanyId &&
          normalizeCredentialField(entry.service) === normalizeCredentialField(item.service) &&
          normalizeCredentialField(entry.url) === normalizeCredentialField(item.url) &&
          normalizeCredentialField(entry.username) === normalizeCredentialField(item.username),
        );

        const importNote = `Importado de ${sourceLabel} em ${new Date().toLocaleString("pt-BR")}.`;
        const payload = {
          user_id: user.id,
          project_id: projectId,
          client: project?.name || null,
          service: item.service.trim() || null,
          url: item.url.trim() || null,
          username: item.username.trim() || null,
          encrypted_password: encoded.encrypted,
          iv: encoded.iv,
          notes: [item.notes.trim(), importNote].filter(Boolean).join("\n\n"),
        };

        const result = existing
          ? await clientDb.from("vault_entries").update(payload).eq("id", existing.id)
          : await clientDb.from("vault_entries").insert(payload);

        if (result.error) {
          throw result.error;
        }

        if (existing) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
      }

      toast.success(`Importacao concluida: ${createdCount} criada(s), ${updatedCount} atualizada(s).`);
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao importar credenciais.");
    } finally {
      setMutating(false);
    }
  }

  async function updateRepositoryCompany(repositoryId: string, projectValue: string) {
    setMutating(true);
    try {
      const result = await clientDb.from("vault_repositories").update({ project_id: projectIdFromSelectValue(projectValue) }).eq("id", repositoryId);
      if (result.error) throw result.error;
      toast.success("Empresa do repositorio atualizada.");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao atualizar empresa do repositorio.");
    } finally {
      setMutating(false);
    }
  }

  async function importWindowsNotes() {
    const notes = splitImportedNotes(windowsImportContent).map((content) => ({ content }));
    if (notes.length === 0) return toast.error("Cole ao menos uma nota para importar.");
    setMutating(true);
    try {
      const selectedSource = windowsSourceKey === "manual" ? null : windowsSources.find((source) => source.key === windowsSourceKey) || null;
      const response = await authorizedFetch("/api/vault/windows-notes", { method: "POST", body: JSON.stringify({ notes, projectId: projectIdFromSelectValue(windowsImportProjectValue), sourceLabel: selectedSource?.label || "Importacao manual", tagsInput: windowsImportTags }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao importar notas.");
      toast.success(`${payload.imported || notes.length} nota(s) importada(s) para o Second Brain.`);
      setWindowsImportContent("");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao importar notas.");
    } finally {
      setMutating(false);
    }
  }

  async function connectGithub() {
    if (!githubConnectionForm.token.trim()) return toast.error("Informe um token do GitHub.");
    setMutating(true);
    try {
      const response = await authorizedFetch("/api/vault/github/connect", { method: "POST", body: JSON.stringify(githubConnectionForm) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao conectar GitHub.");
      toast.success(`GitHub conectado: ${payload.profile?.login || "conta validada"}.`);
      setGithubDialogOpen(false);
      setGithubConnectionForm(EMPTY_GITHUB_CONNECTION_FORM);
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao conectar GitHub.");
    } finally {
      setMutating(false);
    }
  }

  async function syncGithub() {
    setMutating(true);
    try {
      const response = await authorizedFetch("/api/vault/github/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao sincronizar GitHub.");
      toast.success(`${payload.synced || 0} repositorio(s) sincronizado(s) do GitHub.`);
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao sincronizar GitHub.");
    } finally {
      setMutating(false);
    }
  }

  if (loading || authLoading) return <LoadingState message="Carregando hub operacional do Cofre..." />;
  if (!user) return <LoadingState message="Autenticação necessária." />;

  return (
    <div className="space-y-4 md:space-y-6">
      <input
        ref={credentialImportInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void importCredentials(event)}
      />
      <PageHeader
        title="Cofre"
        description="Hub operacional por empresa com credenciais, repositorios, envs e importacoes."
        actions={
          <>
            <Button variant="outline" onClick={() => void handleScan()} disabled={scanBusy}>
              {scanBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Escanear Git local
            </Button>
            <Button onClick={() => openCredentialDialog()}><Plus className="mr-2 h-4 w-4" />Nova credencial</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="text-base">Empresas</CardTitle><CardDescription>Pastas principais do hub operacional.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {folders.map((folder) => {
                const folderStats = {
                  credentials: vaultEntries.filter((entry) => inCompany(entry.project_id) === folder.id).length,
                  repositories: repositories.filter((entry) => inCompany(entry.project_id) === folder.id).length,
                  environments: environmentEntries.filter((entry) => inCompany(entry.project_id) === folder.id).length,
                };
                return (
                  <button key={folder.id} type="button" onClick={() => setSelectedCompanyId(folder.id)} className={cn("w-full rounded-2xl border p-4 text-left transition-colors", folder.id === selectedCompanyId ? "border-primary/60 bg-primary/10" : "border-border/70 bg-background/40 hover:border-primary/40 hover:bg-primary/5")}>
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{folder.label}</p><p className="mt-1 text-xs text-muted-foreground">{folder.description}</p></div><FolderOpen className="h-4 w-4 text-primary" /></div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{folderStats.credentials} credenciais</span><span>{folderStats.repositories} repos</span><span>{folderStats.environments} envs</span></div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4 md:space-y-6">
          <Card className="border-border/70 bg-card/70"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs uppercase tracking-[0.24em] text-primary">Pasta ativa</p><h2 className="mt-1 text-2xl font-bold text-foreground">{selectedFolder?.label || "Cofre"}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedFolder?.description || ""}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Credenciais</p><p className="mt-1 text-2xl font-semibold">{stats.credentials}</p></CardContent></Card><Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Repos</p><p className="mt-1 text-2xl font-semibold">{stats.repositories}</p></CardContent></Card><Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Envs</p><p className="mt-1 text-2xl font-semibold">{stats.environments}</p></CardContent></Card><Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ultimo sync</p><p className="mt-1 text-sm font-medium">{formatDateTime(stats.latestSync)}</p></CardContent></Card></div></CardContent></Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VaultHubTab)} className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="credentials">Credenciais</TabsTrigger><TabsTrigger value="repositories">Repositorios</TabsTrigger><TabsTrigger value="environments">Envs</TabsTrigger><TabsTrigger value="imports">Importacoes</TabsTrigger></TabsList>
              <div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por servico, repo, env ou sync" className="pl-9" /></div>
            </div>

            <TabsContent value="overview" className="space-y-4">
              <Card className="border-border/70 bg-card/70"><CardHeader><CardTitle>Rotinas recentes</CardTitle><CardDescription>Histórico mais recente do Cofre.</CardDescription></CardHeader><CardContent className="space-y-3">{filteredSyncRuns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum sync registrado para esta pasta ainda.</p> : null}{filteredSyncRuns.slice(0, 6).map((run) => <div key={run.id} className="rounded-xl border border-border/60 bg-background/40 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium capitalize">{run.run_type.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{run.summary || "Sem resumo."}</p></div><Badge variant={run.status === "success" ? "default" : run.status === "error" ? "destructive" : "secondary"}>{run.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(run.created_at)}</p></div>)}</CardContent></Card>
            </TabsContent>

            <TabsContent value="credentials" className="space-y-4">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Transferir credenciais</CardTitle>
                    <CardDescription>Exporte a pasta ativa em JSON e importe no outro ambiente para recriar ou atualizar os acessos.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportCredentials} disabled={filteredCredentials.length === 0 || mutating}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar JSON
                    </Button>
                    <Button variant="outline" onClick={openCredentialImport} disabled={mutating}>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar JSON
                    </Button>
                  </div>
                </CardHeader>
              </Card>
              {filteredCredentials.length === 0 ? <EmptyState message="Nenhuma credencial encontrada nesta pasta." /> : null}
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredCredentials.map((entry) => {
                  const secretKey = `credential:${entry.id}`;
                  const password = decodeBrowserSecret(entry.encrypted_password);
                  const secretVisible = !!visibleSecrets[secretKey];
                  return <Card key={entry.id} className="border-border/70 bg-card/70"><CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0"><div><CardTitle className="text-lg">{entry.service || "Servico sem nome"}</CardTitle><CardDescription>{entry.client || GENERAL_PROJECT_LABEL}</CardDescription></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => openCredentialDialog(entry)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => setDeleteCredential(entry)}><Trash2 className="h-4 w-4" /></Button></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Usuário</p><p className="text-sm">{entry.username || "-"}</p></div><div><p className="text-xs text-muted-foreground">URL</p><p className="truncate text-sm">{entry.url || "-"}</p></div></div><div className="rounded-xl border border-border/60 bg-background/40 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Senha</p><p className="font-mono text-sm">{secretVisible ? password || "-" : password ? "****************" : "-"}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => toggleSecret(secretKey)}>{secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button variant="outline" size="icon" onClick={() => void copyToClipboard(password, "Senha")}><Copy className="h-4 w-4" /></Button></div></div></div><p className="text-sm text-muted-foreground">{entry.notes || "Sem observações."}</p></CardContent></Card>;
                })}
              </div>
            </TabsContent>

            <TabsContent value="repositories" className="space-y-4">
              <Card className="border-border/70 bg-card/70"><CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>Integração GitHub</CardTitle><CardDescription>Conecte um token do GitHub para importar repositorios remotos.</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setGithubDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />{activeGithubConnection ? "Trocar token GitHub" : "Conectar GitHub"}</Button><Button onClick={() => void syncGithub()} disabled={!activeGithubConnection || mutating}><RefreshCcw className="mr-2 h-4 w-4" />Sincronizar GitHub</Button></div></CardHeader><CardContent>{activeGithubConnection ? <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-border/60 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Conta</p><p className="mt-1 text-sm font-medium">{activeGithubConnection.github_login}</p></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Conexão</p><p className="mt-1 text-sm font-medium">{activeGithubConnection.display_name}</p></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Ultimo sync</p><p className="mt-1 text-sm font-medium">{formatDateTime(activeGithubConnection.last_synced_at)}</p></div><div className="rounded-xl border border-border/60 bg-background/40 p-4"><p className="text-xs text-muted-foreground">Scopes</p><p className="mt-1 text-sm font-medium">{activeGithubConnection.scopes?.join(", ") || "-"}</p></div></div> : <p className="text-sm text-muted-foreground">Nenhuma conexão GitHub configurada ainda.</p>}</CardContent></Card>
              {filteredRepositories.length === 0 ? <EmptyState message="Nenhum repositorio mapeado. Rode o escaneamento local para popular esta pasta." /> : null}
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredRepositories.map((repository) => {
                  const targetUrl = repository.html_url || repository.remote_url;
                  const localPath = repository.is_remote_only ? "Somente remoto" : repository.local_path || "Não configurado";
                  return <Card key={repository.id} className="border-border/70 bg-card/70"><CardHeader className="space-y-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{repository.repo_name}</CardTitle><CardDescription>{repository.owner_name || "owner não detectado"} | {repository.default_branch || "branch desconhecida"}</CardDescription></div><Badge variant={repository.last_scan_status === "success" ? "default" : "secondary"}>{repository.last_scan_status || "unknown"}</Badge></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{repository.provider}</Badge>{repository.source_type ? <Badge variant="secondary">{repository.source_type}</Badge> : null}<Badge variant="secondary">{repository.detected_environment_count} envs</Badge><Badge variant="secondary">scan {formatDateTime(repository.last_scanned_at)}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Caminho local</p><p className="truncate font-mono text-sm">{localPath}</p></div><div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Remote</p><p className="truncate text-sm">{repository.remote_url || "Não configurado"}</p></div><div className="space-y-2"><Label>Empresa vinculada</Label><Select value={projectSelectValue(repository.project_id)} onValueChange={(value) => void updateRepositoryCompany(repository.id, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { if (!targetUrl) return toast.error("Repositorio sem remote configurado."); window.open(targetUrl, "_blank", "noopener,noreferrer"); }}><ExternalLink className="mr-2 h-4 w-4" />Abrir no Git</Button><Button variant="outline" disabled={!repository.local_path} onClick={() => void copyToClipboard(repository.local_path || "", "Caminho local")}><Copy className="mr-2 h-4 w-4" />Copiar caminho</Button></div></CardContent></Card>;
                })}
              </div>
            </TabsContent>

            <TabsContent value="environments" className="space-y-4">
              {filteredEnvironmentEntries.length === 0 ? <EmptyState message="Nenhuma env importada para esta pasta ainda." /> : null}
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredEnvironmentEntries.map((entry) => {
                  const repository = entry.repository_id ? repositoryMap.get(entry.repository_id) : null;
                  const secretKey = `env:${entry.id}`;
                  const value = decodeBrowserSecret(entry.encrypted_value);
                  const visible = !!visibleSecrets[secretKey];
                  return <Card key={entry.id} className="border-border/70 bg-card/70"><CardHeader className="space-y-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{entry.env_key}</CardTitle><CardDescription>{repository?.repo_name || "Sem repositorio vinculado"}</CardDescription></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{entry.env_scope}</Badge>{entry.detected_provider ? <Badge variant="secondary">{entry.detected_provider}</Badge> : null}</div></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-xs text-muted-foreground">Origem</p><p className="truncate font-mono text-sm">{entry.source_path}</p></div><div className="rounded-xl border border-border/60 bg-background/40 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">Valor</p><p className="truncate font-mono text-sm">{visible ? value || "-" : value ? "****************" : "-"}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => toggleSecret(secretKey)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button variant="outline" size="icon" onClick={() => void copyToClipboard(value, entry.env_key)}><Copy className="h-4 w-4" /></Button></div></div></div></CardContent></Card>;
                })}
              </div>
            </TabsContent>

            <TabsContent value="imports" className="space-y-4 md:space-y-6">
              <Card className="border-border/70 bg-card/70"><CardHeader><CardTitle>Importar notas do Windows</CardTitle><CardDescription>Descubra a fonte e confirme a importacao para o Second Brain.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 lg:grid-cols-3"><div className="space-y-2"><Label>Fonte detectada</Label><Select value={windowsSourceKey} onValueChange={setWindowsSourceKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Importacao manual / colar conteudo</SelectItem>{windowsSources.map((source) => <SelectItem key={source.key} value={source.key}>{source.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Empresa de destino</Label><Select value={windowsImportProjectValue} onValueChange={setWindowsImportProjectValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tags</Label><Input value={windowsImportTags} onChange={(event) => setWindowsImportTags(event.target.value)} placeholder="windows-import, ideia, backlog" /></div></div>{windowsSourceKey !== "manual" ? <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm">{(() => { const source = windowsSources.find((item) => item.key === windowsSourceKey); if (!source) return "Fonte não localizada."; return <div className="space-y-2"><p><strong>Fonte:</strong> {source.label}</p><p><strong>Path:</strong> <span className="font-mono">{source.path}</span></p><p><strong>Status:</strong> {source.supported ? "Suportada" : "Descoberta apenas"}</p><p className="text-muted-foreground">{source.note}</p></div>; })()}</div> : null}<div className="space-y-2"><Label>Conteúdo das notas</Label><Textarea value={windowsImportContent} onChange={(event) => setWindowsImportContent(event.target.value)} className="min-h-[220px]" placeholder={"Cole as notas aqui. Separe uma nota da outra com:\n---"} /><p className="text-xs text-muted-foreground">Use uma linha com <code>---</code> entre notas para criar varios registros.</p></div><div className="flex justify-end"><Button onClick={() => void importWindowsNotes()} disabled={mutating}><Import className="mr-2 h-4 w-4" />Confirmar importacao</Button></div></CardContent></Card>
              <Card className="border-border/70 bg-card/70"><CardHeader><CardTitle>Preview da importacao</CardTitle><CardDescription>{importPreview.length} nota(s) pronta(s) para envio.</CardDescription></CardHeader><CardContent className="space-y-3">{importPreview.length === 0 ? <p className="text-sm text-muted-foreground">Cole o conteúdo das notas para ver o preview aqui.</p> : null}{importPreview.map((item, index) => <div key={`${index}-${item.slice(0, 16)}`} className="rounded-xl border border-border/60 bg-background/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-primary">Nota {index + 1}</p><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item}</p></div>)}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingCredential ? "Editar credencial" : "Nova credencial"}</DialogTitle><DialogDescription>Credencial vinculada a uma empresa do Cofre.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2"><Label>Empresa</Label><Select value={credentialForm.projectValue} onValueChange={(value) => setCredentialForm((current) => ({ ...current, projectValue: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Servico</Label><Input value={credentialForm.service} onChange={(event) => setCredentialForm((current) => ({ ...current, service: event.target.value }))} placeholder="GitHub, Meta Ads, Hostinger..." /></div><div className="space-y-2"><Label>URL</Label><Input value={credentialForm.url} onChange={(event) => setCredentialForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." /></div><div className="space-y-2"><Label>Usuário</Label><Input value={credentialForm.username} onChange={(event) => setCredentialForm((current) => ({ ...current, username: event.target.value }))} placeholder="email ou login" /></div><div className="space-y-2 sm:col-span-2"><Label>Senha / segredo</Label><Input value={credentialForm.password} onChange={(event) => setCredentialForm((current) => ({ ...current, password: event.target.value }))} placeholder="valor secreto" /></div><div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea value={credentialForm.notes} onChange={(event) => setCredentialForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px]" placeholder="Contexto, responsável, observações de acesso..." /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCredentialDialogOpen(false)}>Cancelar</Button><Button onClick={() => void saveCredential()} disabled={mutating}><Save className="mr-2 h-4 w-4" />Salvar</Button></div></DialogContent></Dialog>
      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Conectar GitHub</DialogTitle><DialogDescription>Use um token pessoal com acesso a <code>repo</code> para sincronizar os projetos remotos.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Nome da conexão</Label><Input value={githubConnectionForm.displayName} onChange={(event) => setGithubConnectionForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="GitHub principal" /></div><div className="space-y-2"><Label>Token GitHub</Label><Textarea value={githubConnectionForm.token} onChange={(event) => setGithubConnectionForm((current) => ({ ...current, token: event.target.value }))} className="min-h-[140px] font-mono" placeholder="ghp_... ou github_pat_..." /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setGithubDialogOpen(false)}>Cancelar</Button><Button onClick={() => void connectGithub()} disabled={mutating}><Save className="mr-2 h-4 w-4" />Validar e conectar</Button></div></DialogContent></Dialog>
      <DeleteConfirmDialog open={!!deleteCredential} onOpenChange={(open) => { if (!open) setDeleteCredential(null); }} itemLabel={deleteCredential?.service || "esta credencial"} onConfirm={() => void deleteCredentialEntry()} />
    </div>
  );
}
