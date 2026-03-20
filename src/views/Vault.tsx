"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  DatabaseZap,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Import,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/system/page-header";
import { LoadingState } from "@/components/system/loading-state";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  GENERAL_PROJECT_VALUE,
  GENERAL_PROJECT_LABEL,
  GENERAL_PROJECT_DESCRIPTION,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import { cn } from "@/lib/utils";
import {
  decodeBrowserSecret,
  decodeBrowserSecretPayload,
  encodeBrowserSecret,
  encodeBrowserSecretPayload,
  getCompanyOptionLabel,
  getInitialTab,
  type VaultEnvironmentEntryRecord,
  type VaultGithubConnectionRecord,
  type VaultHubTab,
  type VaultRepositoryRecord,
  type VaultSupabaseCredentialsPayload,
  type VaultSupabaseInstanceRecord,
  type VaultSyncRunRecord,
  type WindowsNoteSourceDetection,
} from "@/lib/vaultHub";
import type { Project, VaultEntry } from "@/types";

type CompanyFolder = {
  id: string;
  label: string;
  description: string;
  projectId: string | null;
};

type CredentialFormState = {
  service: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  projectValue: string;
};

type SupabaseFormState = {
  displayName: string;
  repositoryId: string;
  projectValue: string;
  projectRef: string;
  projectUrl: string;
  apiUrl: string;
  keepaliveType: "rest" | "sql";
  keepaliveIntervalHours: string;
  email: string;
  anonKey: string;
  serviceRoleKey: string;
  accessToken: string;
  managementToken: string;
  databaseUrl: string;
  databasePassword: string;
  supabasePassword: string;
  notes: string;
  keepaliveEnabled: boolean;
};

type GithubConnectionFormState = {
  displayName: string;
  token: string;
};

const EMPTY_CREDENTIAL_FORM: CredentialFormState = {
  service: "",
  url: "",
  username: "",
  password: "",
  notes: "",
  projectValue: GENERAL_PROJECT_VALUE,
};

const EMPTY_SUPABASE_FORM: SupabaseFormState = {
  displayName: "",
  repositoryId: "none",
  projectValue: GENERAL_PROJECT_VALUE,
  projectRef: "",
  projectUrl: "",
  apiUrl: "",
  keepaliveType: "rest",
  keepaliveIntervalHours: "24",
  email: "",
  anonKey: "",
  serviceRoleKey: "",
  accessToken: "",
  managementToken: "",
  databaseUrl: "",
  databasePassword: "",
  supabasePassword: "",
  notes: "",
  keepaliveEnabled: true,
};

const EMPTY_GITHUB_CONNECTION_FORM: GithubConnectionFormState = {
  displayName: "GitHub principal",
  token: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeEvidenceList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getEmptySupabaseCredentials(): VaultSupabaseCredentialsPayload {
  return {
    email: "",
    anonKey: "",
    serviceRoleKey: "",
    accessToken: "",
    managementToken: "",
    databaseUrl: "",
    databasePassword: "",
    supabasePassword: "",
  };
}

function splitImportedNotes(rawContent: string) {
  return rawContent
    .split(/\n---\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEntryCompanyId(entry: Pick<VaultEntry, "project_id">) {
  return entry.project_id || GENERAL_PROJECT_VALUE;
}

function getRepositoryCompanyId(entry: Pick<VaultRepositoryRecord, "project_id">) {
  return entry.project_id || GENERAL_PROJECT_VALUE;
}

function getEnvironmentCompanyId(entry: Pick<VaultEnvironmentEntryRecord, "project_id">) {
  return entry.project_id || GENERAL_PROJECT_VALUE;
}

function getSupabaseCompanyId(entry: Pick<VaultSupabaseInstanceRecord, "project_id">) {
  return entry.project_id || GENERAL_PROJECT_VALUE;
}

function getSyncCompanyId(entry: Pick<VaultSyncRunRecord, "project_id">) {
  return entry.project_id || GENERAL_PROJECT_VALUE;
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
  const [supabaseInstances, setSupabaseInstances] = useState<VaultSupabaseInstanceRecord[]>([]);
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

  const [supabaseDialogOpen, setSupabaseDialogOpen] = useState(false);
  const [editingSupabaseInstance, setEditingSupabaseInstance] = useState<VaultSupabaseInstanceRecord | null>(null);
  const [supabaseForm, setSupabaseForm] = useState<SupabaseFormState>(EMPTY_SUPABASE_FORM);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubConnectionForm, setGithubConnectionForm] = useState<GithubConnectionFormState>(EMPTY_GITHUB_CONNECTION_FORM);

  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const [windowsSourceKey, setWindowsSourceKey] = useState("manual");
  const [windowsImportProjectValue, setWindowsImportProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [windowsImportTags, setWindowsImportTags] = useState("windows-import");
  const [windowsImportContent, setWindowsImportContent] = useState("");

  async function authorizedFetch(input: string, init?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers(init?.headers || {});
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(input, {
      ...init,
      headers,
    });
  }

  async function loadData() {
    if (!user) return;
    setLoading(true);

    try {
      const db = supabase as any;
      const [entriesRes, projectsRes, repositoriesRes, envsRes, supabaseRes, syncRes, githubRes] = await Promise.all([
        db.from("vault_entries").select("*").order("updated_at", { ascending: false }),
        db.from("projects").select("*").order("name"),
        db.from("vault_repositories").select("*").order("repo_name"),
        db.from("vault_environment_entries").select("*").order("env_key"),
        db.from("vault_supabase_instances").select("*").order("updated_at", { ascending: false }),
        db.from("vault_sync_runs").select("*").order("created_at", { ascending: false }).limit(30),
        db.from("vault_github_connections").select("*").order("updated_at", { ascending: false }),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (repositoriesRes.error) throw repositoriesRes.error;
      if (envsRes.error) throw envsRes.error;
      if (supabaseRes.error) throw supabaseRes.error;
      if (syncRes.error) throw syncRes.error;
      if (githubRes.error) throw githubRes.error;

      setVaultEntries((entriesRes.data || []) as VaultEntry[]);
      setProjects((projectsRes.data || []) as Project[]);
      setRepositories((repositoriesRes.data || []) as VaultRepositoryRecord[]);
      setEnvironmentEntries((envsRes.data || []) as VaultEnvironmentEntryRecord[]);
      setSupabaseInstances((supabaseRes.data || []) as VaultSupabaseInstanceRecord[]);
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
    if (!user) {
      setLoading(false);
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    const company = searchParams?.get("company") || GENERAL_PROJECT_VALUE;
    const tab = getInitialTab(searchParams?.get("tab") || null);
    setSelectedCompanyId(company);
    setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.set("company", selectedCompanyId);
    next.set("tab", activeTab);
    const current = searchParams?.toString() || "";
    const target = next.toString();
    if (current !== target) {
      router.replace(`${pathname}?${target}`, { scroll: false });
    }
  }, [activeTab, pathname, router, searchParams, selectedCompanyId]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const repositoryMap = useMemo(
    () => new Map(repositories.map((repository) => [repository.id, repository])),
    [repositories],
  );

  const folders = useMemo<CompanyFolder[]>(
    () => [
      {
        id: GENERAL_PROJECT_VALUE,
        label: GENERAL_PROJECT_LABEL,
        description: GENERAL_PROJECT_DESCRIPTION,
        projectId: null,
      },
      ...projects.map((project) => ({
        id: project.id,
        label: project.name,
        description: project.client || "Pasta operacional da empresa",
        projectId: project.id,
      })),
    ],
    [projects],
  );

  const selectedFolder =
    folders.find((folder) => folder.id === selectedCompanyId) || folders[0] || null;
  const selectedProjectId = selectedFolder?.projectId || null;
  const searchTerm = search.trim().toLowerCase();

  const filteredCredentials = useMemo(
    () =>
      vaultEntries
        .filter((entry) => getEntryCompanyId(entry) === selectedCompanyId)
        .filter((entry) => {
          if (!searchTerm) return true;
          const haystack = [
            entry.service,
            entry.url,
            entry.username,
            entry.notes,
            entry.client,
          ]
            .join("\n")
            .toLowerCase();
          return haystack.includes(searchTerm);
        }),
    [searchTerm, selectedCompanyId, vaultEntries],
  );

  const filteredRepositories = useMemo(
    () =>
      repositories
        .filter((repository) => getRepositoryCompanyId(repository) === selectedCompanyId)
        .filter((repository) => {
          if (!searchTerm) return true;
          return [
            repository.repo_name,
            repository.owner_name,
            repository.remote_url,
            repository.local_path,
            repository.default_branch,
          ]
            .join("\n")
            .toLowerCase()
            .includes(searchTerm);
        }),
    [repositories, searchTerm, selectedCompanyId],
  );

  const filteredEnvironmentEntries = useMemo(
    () =>
      environmentEntries
        .filter((entry) => getEnvironmentCompanyId(entry) === selectedCompanyId)
        .filter((entry) => {
          if (!searchTerm) return true;
          const repo = entry.repository_id ? repositoryMap.get(entry.repository_id) : null;
          return [entry.env_key, entry.source_path, entry.detected_provider, entry.env_scope, repo?.repo_name]
            .join("\n")
            .toLowerCase()
            .includes(searchTerm);
        }),
    [environmentEntries, repositoryMap, searchTerm, selectedCompanyId],
  );

  const filteredSupabaseInstances = useMemo(
    () =>
      supabaseInstances
        .filter((instance) => getSupabaseCompanyId(instance) === selectedCompanyId)
        .filter((instance) => {
          if (!searchTerm) return true;
          const repo = instance.repository_id ? repositoryMap.get(instance.repository_id) : null;
          return [
            instance.display_name,
            instance.project_ref,
            instance.project_url,
            instance.api_url,
            instance.notes,
            repo?.repo_name,
          ]
            .join("\n")
            .toLowerCase()
            .includes(searchTerm);
        }),
    [repositoryMap, searchTerm, selectedCompanyId, supabaseInstances],
  );

  const filteredSyncRuns = useMemo(
    () =>
      syncRuns
        .filter((run) => getSyncCompanyId(run) === selectedCompanyId)
        .filter((run) => {
          if (!searchTerm) return true;
          return [run.run_type, run.summary, run.status].join("\n").toLowerCase().includes(searchTerm);
        }),
    [searchTerm, selectedCompanyId, syncRuns],
  );

  const selectedCompanyStats = useMemo(() => {
    const relatedRuns = syncRuns.filter((run) => getSyncCompanyId(run) === selectedCompanyId);
    return {
      credentials: vaultEntries.filter((entry) => getEntryCompanyId(entry) === selectedCompanyId).length,
      repositories: repositories.filter((entry) => getRepositoryCompanyId(entry) === selectedCompanyId).length,
      environments: environmentEntries.filter((entry) => getEnvironmentCompanyId(entry) === selectedCompanyId).length,
      supabase: supabaseInstances.filter((entry) => getSupabaseCompanyId(entry) === selectedCompanyId).length,
      latestSync: relatedRuns[0]?.created_at || null,
    };
  }, [environmentEntries, repositories, selectedCompanyId, supabaseInstances, syncRuns, vaultEntries]);

  const importPreview = useMemo(() => splitImportedNotes(windowsImportContent), [windowsImportContent]);
  const activeGithubConnection = useMemo(
    () => githubConnections.find((connection) => connection.is_active) || null,
    [githubConnections],
  );

  function resetCredentialForm() {
    setEditingCredential(null);
    setCredentialForm({ ...EMPTY_CREDENTIAL_FORM, projectValue: selectedCompanyId });
  }

  function resetSupabaseForm() {
    setEditingSupabaseInstance(null);
    setSupabaseForm({ ...EMPTY_SUPABASE_FORM, projectValue: selectedCompanyId });
  }

  function resetGithubConnectionForm() {
    setGithubConnectionForm(EMPTY_GITHUB_CONNECTION_FORM);
  }

  function toggleSecret(key: string) {
    setVisibleSecrets((current) => ({ ...current, [key]: !current[key] }));
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Nao foi possivel copiar ${label.toLowerCase()}.`);
    }
  }

  async function handleScan() {
    setScanBusy(true);
    try {
      const response = await authorizedFetch("/api/vault/scan", {
        method: "POST",
        body: JSON.stringify({ rootPath: "D:\\GitHub" }),
      });
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
    if (entry) {
      setEditingCredential(entry);
      setCredentialForm({
        service: entry.service || "",
        url: entry.url || "",
        username: entry.username || "",
        password: decodeBrowserSecret(entry.encrypted_password),
        notes: entry.notes || "",
        projectValue: projectSelectValue(entry.project_id),
      });
    } else {
      resetCredentialForm();
    }
    setCredentialDialogOpen(true);
  }

  async function saveCredential() {
    if (!user) return;

    setMutating(true);
    try {
      const projectId = projectIdFromSelectValue(credentialForm.projectValue);
      const project = projectId ? projectMap.get(projectId) : null;
      const encoded = encodeBrowserSecret(credentialForm.password);
      const payload = {
        user_id: user.id,
        project_id: projectId,
        client: project?.name || null,
        service: credentialForm.service.trim() || null,
        url: credentialForm.url.trim() || null,
        username: credentialForm.username.trim() || null,
        encrypted_password: encoded.encrypted,
        iv: encoded.iv,
        notes: credentialForm.notes.trim() || null,
      };

      const db = supabase as any;
      const result = editingCredential
        ? await db.from("vault_entries").update(payload).eq("id", editingCredential.id)
        : await db.from("vault_entries").insert(payload);

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
      const db = supabase as any;
      const result = await db.from("vault_entries").delete().eq("id", deleteCredential.id);
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

  async function updateRepositoryCompany(repositoryId: string, projectValue: string) {
    setMutating(true);
    try {
      const db = supabase as any;
      const projectId = projectIdFromSelectValue(projectValue);
      const result = await db.from("vault_repositories").update({ project_id: projectId }).eq("id", repositoryId);
      if (result.error) throw result.error;
      toast.success("Empresa do repositorio atualizada.");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao atualizar empresa do repositorio.");
    } finally {
      setMutating(false);
    }
  }

  function openSupabaseDialog(instance?: VaultSupabaseInstanceRecord) {
    if (instance) {
      const credentials = {
        ...getEmptySupabaseCredentials(),
        ...(decodeBrowserSecretPayload<VaultSupabaseCredentialsPayload>(instance.encrypted_credentials_payload) || {}),
      };
      if (!credentials.serviceRoleKey && instance.encrypted_credential) {
        credentials.serviceRoleKey = decodeBrowserSecret(instance.encrypted_credential);
      }
      setEditingSupabaseInstance(instance);
      setSupabaseForm({
        displayName: instance.display_name || "",
        repositoryId: instance.repository_id || "none",
        projectValue: projectSelectValue(instance.project_id),
        projectRef: instance.project_ref || "",
        projectUrl: instance.project_url || "",
        apiUrl: instance.api_url || "",
        keepaliveType: instance.keepalive_type,
        keepaliveIntervalHours: String(instance.keepalive_interval_hours || 24),
        email: credentials.email,
        anonKey: credentials.anonKey,
        serviceRoleKey: credentials.serviceRoleKey,
        accessToken: credentials.accessToken,
        managementToken: credentials.managementToken,
        databaseUrl: credentials.databaseUrl,
        databasePassword: credentials.databasePassword,
        supabasePassword: credentials.supabasePassword,
        notes: instance.notes || "",
        keepaliveEnabled: instance.keepalive_enabled,
      });
    } else {
      resetSupabaseForm();
    }
    setSupabaseDialogOpen(true);
  }

  async function saveSupabaseInstance() {
    if (!user) return;

    setMutating(true);
    try {
      const projectId = projectIdFromSelectValue(supabaseForm.projectValue);
      const credentialsPayload: VaultSupabaseCredentialsPayload = {
        email: supabaseForm.email.trim(),
        anonKey: supabaseForm.anonKey.trim(),
        serviceRoleKey: supabaseForm.serviceRoleKey.trim(),
        accessToken: supabaseForm.accessToken.trim(),
        managementToken: supabaseForm.managementToken.trim(),
        databaseUrl: supabaseForm.databaseUrl.trim(),
        databasePassword: supabaseForm.databasePassword.trim(),
        supabasePassword: supabaseForm.supabasePassword.trim(),
      };
      const encodedCredentialsPayload = encodeBrowserSecretPayload(credentialsPayload);
      const keepaliveCredential =
        credentialsPayload.serviceRoleKey ||
        credentialsPayload.anonKey ||
        credentialsPayload.accessToken;
      const encodedCredential = keepaliveCredential ? encodeBrowserSecret(keepaliveCredential) : null;
      const payload = {
        user_id: user.id,
        project_id: projectId,
        repository_id: supabaseForm.repositoryId === "none" ? null : supabaseForm.repositoryId,
        display_name: supabaseForm.displayName.trim(),
        project_ref: supabaseForm.projectRef.trim() || null,
        project_url: supabaseForm.projectUrl.trim() || null,
        api_url: supabaseForm.apiUrl.trim() || null,
        keepalive_type: supabaseForm.keepaliveType,
        keepalive_enabled: supabaseForm.keepaliveEnabled,
        keepalive_interval_hours: Number(supabaseForm.keepaliveIntervalHours) || 24,
        encrypted_credential: encodedCredential?.encrypted || null,
        credential_iv: encodedCredential?.iv || null,
        encrypted_credentials_payload: encodedCredentialsPayload.encrypted,
        credentials_payload_iv: encodedCredentialsPayload.iv,
        notes: supabaseForm.notes.trim() || null,
      };

      const db = supabase as any;
      const result = editingSupabaseInstance
        ? await db.from("vault_supabase_instances").update(payload).eq("id", editingSupabaseInstance.id)
        : await db.from("vault_supabase_instances").insert(payload);

      if (result.error) throw result.error;
      toast.success(editingSupabaseInstance ? "Instancia Supabase atualizada." : "Instancia Supabase criada.");
      setSupabaseDialogOpen(false);
      resetSupabaseForm();
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar instancia Supabase.");
    } finally {
      setMutating(false);
    }
  }

  async function toggleKeepalive(instance: VaultSupabaseInstanceRecord, value: boolean) {
    setMutating(true);
    try {
      const db = supabase as any;
      const result = await db
        .from("vault_supabase_instances")
        .update({ keepalive_enabled: value })
        .eq("id", instance.id);
      if (result.error) throw result.error;
      toast.success(value ? "Keepalive ativado." : "Keepalive pausado.");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao atualizar keepalive.");
    } finally {
      setMutating(false);
    }
  }

  async function runKeepalive(instanceId: string) {
    setMutating(true);
    try {
      const response = await authorizedFetch("/api/vault/keepalive", {
        method: "POST",
        body: JSON.stringify({ instanceId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao executar keepalive.");

      const result = Array.isArray(payload.results) ? payload.results[0] : null;
      toast.success(result?.summary || "Keepalive executado.");
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao executar keepalive.");
    } finally {
      setMutating(false);
    }
  }

  async function importWindowsNotes() {
    const notes = splitImportedNotes(windowsImportContent).map((content) => ({ content }));
    if (notes.length === 0) {
      toast.error("Cole ao menos uma nota para importar.");
      return;
    }

    setMutating(true);
    try {
      const selectedSource =
        windowsSourceKey === "manual"
          ? null
          : windowsSources.find((source) => source.key === windowsSourceKey) || null;

      const response = await authorizedFetch("/api/vault/windows-notes", {
        method: "POST",
        body: JSON.stringify({
          notes,
          projectId: projectIdFromSelectValue(windowsImportProjectValue),
          sourceLabel: selectedSource?.label || "Importacao manual",
          tagsInput: windowsImportTags,
        }),
      });
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
    if (!githubConnectionForm.token.trim()) {
      toast.error("Informe um token do GitHub.");
      return;
    }

    setMutating(true);
    try {
      const response = await authorizedFetch("/api/vault/github/connect", {
        method: "POST",
        body: JSON.stringify(githubConnectionForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Falha ao conectar GitHub.");
      }

      toast.success(`GitHub conectado: ${payload.profile?.login || "conta validada"}.`);
      setGithubDialogOpen(false);
      resetGithubConnectionForm();
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
      const response = await authorizedFetch("/api/vault/github/sync", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Falha ao sincronizar GitHub.");
      }

      toast.success(
        `${payload.synced || 0} repositorio(s) sincronizado(s) do GitHub. ${payload.supabaseDetected || 0} com Supabase detectado.`,
      );
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao sincronizar GitHub.");
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return <LoadingState message="Carregando hub operacional do Cofre..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cofre"
        description="Hub operacional por empresa com credenciais, repositórios, envs, Supabase e importações."
        actions={
          <>
            <Button variant="outline" onClick={() => void handleScan()} disabled={scanBusy}>
              {scanBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Escanear Git local
            </Button>
            <Button onClick={() => openCredentialDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova credencial
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Empresas</CardTitle>
              <CardDescription>Pastas principais do hub operacional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {folders.map((folder) => {
                const folderStats = {
                  credentials: vaultEntries.filter((entry) => getEntryCompanyId(entry) === folder.id).length,
                  repositories: repositories.filter((entry) => getRepositoryCompanyId(entry) === folder.id).length,
                  supabase: supabaseInstances.filter((entry) => getSupabaseCompanyId(entry) === folder.id).length,
                };

                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(folder.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-colors",
                      folder.id === selectedCompanyId
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/70 bg-background/40 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{folder.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{folder.description}</p>
                      </div>
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{folderStats.credentials} credenciais</span>
                      <span>{folderStats.repositories} repos</span>
                      <span>{folderStats.supabase} Supabase</span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/70">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Pasta ativa</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">{selectedFolder?.label || "Cofre"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedFolder?.description || ""}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Credenciais</p><p className="mt-1 text-2xl font-semibold">{selectedCompanyStats.credentials}</p></CardContent></Card>
                <Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Repos</p><p className="mt-1 text-2xl font-semibold">{selectedCompanyStats.repositories}</p></CardContent></Card>
                <Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Envs</p><p className="mt-1 text-2xl font-semibold">{selectedCompanyStats.environments}</p></CardContent></Card>
                <Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Supabase</p><p className="mt-1 text-2xl font-semibold">{selectedCompanyStats.supabase}</p></CardContent></Card>
                <Card className="border-border/60 bg-background/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ultimo sync</p><p className="mt-1 text-sm font-medium">{formatDateTime(selectedCompanyStats.latestSync)}</p></CardContent></Card>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VaultHubTab)} className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                <TabsTrigger value="overview">Visao geral</TabsTrigger>
                <TabsTrigger value="credentials">Credenciais</TabsTrigger>
                <TabsTrigger value="repositories">Repositorios</TabsTrigger>
                <TabsTrigger value="environments">Envs</TabsTrigger>
                <TabsTrigger value="supabase">Supabase</TabsTrigger>
                <TabsTrigger value="imports">Importacoes</TabsTrigger>
              </TabsList>

              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por empresa, serviço, repo, env ou sync"
                  className="pl-9"
                />
              </div>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70 bg-card/70">
                  <CardHeader>
                    <CardTitle>Resumo operacional</CardTitle>
                    <CardDescription>Panorama da pasta selecionada.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4"><p className="text-xs text-muted-foreground">Credenciais ativas</p><p className="mt-1 text-xl font-semibold">{selectedCompanyStats.credentials}</p></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4"><p className="text-xs text-muted-foreground">Repositorios mapeados</p><p className="mt-1 text-xl font-semibold">{selectedCompanyStats.repositories}</p></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4"><p className="text-xs text-muted-foreground">Enviroments importadas</p><p className="mt-1 text-xl font-semibold">{selectedCompanyStats.environments}</p></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-4"><p className="text-xs text-muted-foreground">Instancias Supabase</p><p className="mt-1 text-xl font-semibold">{selectedCompanyStats.supabase}</p></div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/70">
                  <CardHeader>
                    <CardTitle>Ultimo pulso local</CardTitle>
                    <CardDescription>Status recente das rotinas do Cofre.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredSyncRuns.slice(0, 5).map((run) => (
                      <div key={run.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium capitalize">{run.run_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{run.summary || "Sem resumo."}</p>
                          </div>
                          <Badge variant={run.status === "success" ? "default" : run.status === "error" ? "destructive" : "secondary"}>
                            {run.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(run.created_at)}</p>
                      </div>
                    ))}
                    {filteredSyncRuns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum sync registrado para esta pasta ainda.</p> : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="credentials" className="space-y-4">
              {filteredCredentials.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/50">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma credencial encontrada nesta pasta.
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredCredentials.map((entry) => {
                  const secretKey = `credential:${entry.id}`;
                  const password = decodeBrowserSecret(entry.encrypted_password);
                  const secretVisible = !!visibleSecrets[secretKey];

                  return (
                    <Card key={entry.id} className="border-border/70 bg-card/70">
                      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                        <div>
                          <CardTitle className="text-lg">{entry.service || "Servico sem nome"}</CardTitle>
                          <CardDescription>{entry.client || GENERAL_PROJECT_LABEL}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => openCredentialDialog(entry)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => setDeleteCredential(entry)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><p className="text-xs text-muted-foreground">Usuario</p><p className="text-sm">{entry.username || "-"}</p></div>
                          <div><p className="text-xs text-muted-foreground">URL</p><p className="truncate text-sm">{entry.url || "-"}</p></div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Senha</p>
                              <p className="font-mono text-sm">{secretVisible ? password || "-" : password ? "••••••••••••" : "-"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" onClick={() => toggleSecret(secretKey)}>
                                {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => void copyToClipboard(password, "Senha")}><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground">{entry.notes || "Sem observacoes."}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="repositories" className="space-y-4">
              <Card className="border-border/70 bg-card/70">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Integração GitHub</CardTitle>
                    <CardDescription>Conecte um token do GitHub para importar repositorios e organizações remotas.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setGithubDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {activeGithubConnection ? "Trocar token GitHub" : "Conectar GitHub"}
                    </Button>
                    <Button onClick={() => void syncGithub()} disabled={!activeGithubConnection || mutating}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Sincronizar GitHub
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeGithubConnection ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                        <p className="text-xs text-muted-foreground">Conta</p>
                        <p className="mt-1 text-sm font-medium">{activeGithubConnection.github_login}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                        <p className="text-xs text-muted-foreground">Último sync</p>
                        <p className="mt-1 text-sm font-medium">{formatDateTime(activeGithubConnection.last_synced_at)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                        <p className="text-xs text-muted-foreground">Scopes</p>
                        <p className="mt-1 text-sm font-medium">{activeGithubConnection.scopes?.join(", ") || "-"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma conexão GitHub configurada ainda.</p>
                  )}
                </CardContent>
              </Card>

              {filteredRepositories.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/50">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum repositorio mapeado. Rode o escaneamento local para popular esta pasta.
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredRepositories.map((repository) => (
                  (() => {
                    const evidence = normalizeEvidenceList(repository.supabase_detection_evidence);
                    return (
                  <Card key={repository.id} className="border-border/70 bg-card/70">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{repository.repo_name}</CardTitle>
                          <CardDescription>{repository.owner_name || "owner nao detectado"} · {repository.default_branch || "branch desconhecida"}</CardDescription>
                        </div>
                        <Badge variant={repository.last_scan_status === "success" ? "default" : "secondary"}>
                          {repository.last_scan_status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{repository.provider}</Badge>
                        {repository.source_type ? <Badge variant="secondary">{repository.source_type}</Badge> : null}
                        <Badge variant="secondary">{repository.detected_environment_count} envs</Badge>
                        {repository.supabase_detected ? <Badge>supabase detectado</Badge> : null}
                        <Badge variant="secondary">scan {formatDateTime(repository.last_scanned_at)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">Caminho local</p>
                        <p className="truncate font-mono text-sm">{repository.is_remote_only ? "Somente remoto" : repository.local_path}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">Remote</p>
                        <p className="truncate text-sm">{repository.remote_url || "Nao configurado"}</p>
                      </div>
                      {repository.supabase_detected ? (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Supabase detectado no repositório GitHub</p>
                              <p className="text-xs text-muted-foreground">
                                Evidência remota encontrada em {formatDateTime(repository.supabase_detection_scanned_at || repository.last_scanned_at)}.
                              </p>
                            </div>
                            <DatabaseZap className="h-4 w-4 text-primary" />
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Project ref</p>
                              <p className="text-sm">{repository.supabase_project_ref || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">API URL</p>
                              <p className="truncate text-sm">{repository.supabase_api_url || "-"}</p>
                            </div>
                          </div>
                          {repository.supabase_project_url ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(repository.supabase_project_url || "", "_blank", "noopener,noreferrer")}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir dashboard Supabase
                              </Button>
                              {repository.supabase_api_url ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void copyToClipboard(repository.supabase_api_url || "", "API URL Supabase")}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar API URL
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          {evidence.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs text-muted-foreground">Arquivos com evidência</p>
                              <div className="flex flex-wrap gap-2">
                                {evidence.slice(0, 6).map((item) => (
                                  <Badge key={item} variant="secondary" className="font-mono text-[11px]">
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Label>Empresa vinculada</Label>
                        <Select
                          value={projectSelectValue(repository.project_id)}
                          onValueChange={(value) => void updateRepositoryCompany(repository.id, value)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (!repository.remote_url) {
                              const targetUrl = repository.html_url || repository.remote_url;
                              if (!targetUrl) {
                                toast.error("Repositorio sem URL configurada.");
                                return;
                              }
                              window.open(targetUrl, "_blank", "noopener,noreferrer");
                              return;
                            }
                            const targetUrl = repository.html_url || repository.remote_url;
                            if (!targetUrl) {
                              toast.error("Repositorio sem remote configurado.");
                              return;
                            }
                            window.open(targetUrl, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir no Git
                        </Button>
                        <Button variant="outline" onClick={() => void copyToClipboard(repository.local_path, "Caminho local")}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar caminho
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                    );
                  })()
                ))}
              </div>
            </TabsContent>

            <TabsContent value="environments" className="space-y-4">
              {filteredEnvironmentEntries.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/50">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma env importada para esta pasta ainda.
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredEnvironmentEntries.map((entry) => {
                  const repo = entry.repository_id ? repositoryMap.get(entry.repository_id) : null;
                  const secretKey = `env:${entry.id}`;
                  const value = decodeBrowserSecret(entry.encrypted_value);
                  const visible = !!visibleSecrets[secretKey];

                  return (
                    <Card key={entry.id} className="border-border/70 bg-card/70">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{entry.env_key}</CardTitle>
                            <CardDescription>{repo?.repo_name || "Sem repositorio vinculado"}</CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{entry.env_scope}</Badge>
                            {entry.detected_provider ? <Badge variant="secondary">{entry.detected_provider}</Badge> : null}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <p className="text-xs text-muted-foreground">Origem</p>
                          <p className="truncate font-mono text-sm">{entry.source_path}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Valor</p>
                              <p className="truncate font-mono text-sm">{visible ? value || "-" : value ? "••••••••••••••••" : "-"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" onClick={() => toggleSecret(secretKey)}>
                                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => void copyToClipboard(value, entry.env_key)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="supabase" className="space-y-4">
              <Alert className="border-primary/30 bg-primary/5">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Keepalive planejado por projeto</AlertTitle>
                <AlertDescription>
                  O keepalive ajuda a evitar inatividade ou cold start em projetos Supabase. Ele nao substitui backup,
                  retenção nem proteção de dados.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end">
                <Button onClick={() => openSupabaseDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova instancia Supabase
                </Button>
              </div>

              {filteredSupabaseInstances.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/50">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma instancia Supabase encontrada nesta pasta.
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredSupabaseInstances.map((instance) => {
                  const repo = instance.repository_id ? repositoryMap.get(instance.repository_id) : null;
                  const credentials = {
                    ...getEmptySupabaseCredentials(),
                    ...(decodeBrowserSecretPayload<VaultSupabaseCredentialsPayload>(instance.encrypted_credentials_payload) || {}),
                  };
                  if (!credentials.serviceRoleKey && instance.encrypted_credential) {
                    credentials.serviceRoleKey = decodeBrowserSecret(instance.encrypted_credential);
                  }
                  const credentialItems = [
                    { label: "Email", value: credentials.email, secret: false },
                    { label: "Anon key", value: credentials.anonKey, secret: true },
                    { label: "Service role", value: credentials.serviceRoleKey, secret: true },
                    { label: "Access token", value: credentials.accessToken, secret: true },
                    { label: "Management token", value: credentials.managementToken, secret: true },
                    { label: "Database URL", value: credentials.databaseUrl, secret: false },
                    { label: "Senha DB", value: credentials.databasePassword, secret: true },
                    { label: "Senha Supabase", value: credentials.supabasePassword, secret: true },
                  ].filter((item) => item.value);

                  return (
                    <Card key={instance.id} className="border-border/70 bg-card/70">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{instance.display_name}</CardTitle>
                            <CardDescription>{repo?.repo_name || getCompanyOptionLabel(projectMap.get(instance.project_id || "") || null)}</CardDescription>
                          </div>
                          <Button variant="outline" size="icon" onClick={() => openSupabaseDialog(instance)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={instance.keepalive_enabled ? "default" : "secondary"}>
                            {instance.keepalive_enabled ? "keepalive ativo" : "keepalive pausado"}
                          </Badge>
                          <Badge variant="secondary">{instance.keepalive_type}</Badge>
                          <Badge variant="secondary">{instance.keepalive_interval_hours}h</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><p className="text-xs text-muted-foreground">Project ref</p><p className="text-sm">{instance.project_ref || "-"}</p></div>
                          <div><p className="text-xs text-muted-foreground">Ultimo status</p><p className="text-sm">{instance.last_keepalive_status || "-"}</p></div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <p className="text-xs text-muted-foreground">API URL</p>
                          <p className="truncate text-sm">{instance.api_url || "-"}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {credentialItems.length === 0 ? (
                            <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground sm:col-span-2">
                              Nenhuma credencial adicional cadastrada nesta instancia.
                            </div>
                          ) : null}
                          {credentialItems.map((item) => {
                            const credentialKey = `supabase:${instance.id}:${item.label}`;
                            const visible = !!visibleSecrets[credentialKey];

                            return (
                              <div key={item.label} className="rounded-xl border border-border/60 bg-background/40 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                    <p className="truncate font-mono text-sm">
                                      {item.secret && !visible ? "••••••••••••••••" : item.value}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {item.secret ? (
                                      <Button variant="outline" size="icon" onClick={() => toggleSecret(credentialKey)}>
                                        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </Button>
                                    ) : null}
                                    <Button variant="outline" size="icon" onClick={() => void copyToClipboard(item.value, item.label)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">Ultima execucao: {formatDateTime(instance.last_keepalive_at)}</div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant={instance.keepalive_enabled ? "outline" : "default"} onClick={() => void toggleKeepalive(instance, !instance.keepalive_enabled)}>
                            <DatabaseZap className="mr-2 h-4 w-4" />
                            {instance.keepalive_enabled ? "Pausar keepalive" : "Ativar keepalive"}
                          </Button>
                          <Button variant="outline" onClick={() => void runKeepalive(instance.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Executar agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="imports" className="space-y-6">
              <Card className="border-border/70 bg-card/70">
                <CardHeader>
                  <CardTitle>Importar notas do Windows</CardTitle>
                  <CardDescription>Fluxo em duas etapas: descobrir a fonte e confirmar a importacao para o Second Brain.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Fonte detectada</Label>
                      <Select value={windowsSourceKey} onValueChange={setWindowsSourceKey}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Importacao manual / colar conteudo</SelectItem>
                          {windowsSources.map((source) => (
                            <SelectItem key={source.key} value={source.key}>{source.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Empresa de destino</Label>
                      <Select value={windowsImportProjectValue} onValueChange={setWindowsImportProjectValue}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <Input value={windowsImportTags} onChange={(event) => setWindowsImportTags(event.target.value)} placeholder="windows-import, ideia, backlog" />
                    </div>
                  </div>

                  {windowsSourceKey !== "manual" ? (
                    <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm">
                      {(() => {
                        const source = windowsSources.find((item) => item.key === windowsSourceKey);
                        if (!source) return "Fonte nao localizada.";
                        return (
                          <div className="space-y-2">
                            <p><strong>Fonte:</strong> {source.label}</p>
                            <p><strong>Path:</strong> <span className="font-mono">{source.path}</span></p>
                            <p><strong>Status:</strong> {source.supported ? "Suportada" : "Descoberta apenas"}</p>
                            <p className="text-muted-foreground">{source.note}</p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Conteudo das notas</Label>
                    <Textarea
                      value={windowsImportContent}
                      onChange={(event) => setWindowsImportContent(event.target.value)}
                      className="min-h-[220px]"
                      placeholder={"Cole as notas aqui. Separe uma nota da outra com:\n---"}
                    />
                    <p className="text-xs text-muted-foreground">Use uma linha com <code>---</code> entre notas para criar varios registros.</p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => void importWindowsNotes()} disabled={mutating}>
                      <Import className="mr-2 h-4 w-4" />
                      Confirmar importacao
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/70">
                <CardHeader>
                  <CardTitle>Preview da importacao</CardTitle>
                  <CardDescription>{importPreview.length} nota(s) pronta(s) para envio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {importPreview.length === 0 ? <p className="text-sm text-muted-foreground">Cole o conteudo das notas para ver o preview aqui.</p> : null}
                  {importPreview.map((item, index) => (
                    <div key={`${index}-${item.slice(0, 16)}`} className="rounded-xl border border-border/60 bg-background/40 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-primary">Nota {index + 1}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCredential ? "Editar credencial" : "Nova credencial"}</DialogTitle>
            <DialogDescription>Credencial vinculada a uma empresa/pasta do Cofre.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={credentialForm.projectValue} onValueChange={(value) => setCredentialForm((current) => ({ ...current, projectValue: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Servico</Label>
              <Input value={credentialForm.service} onChange={(event) => setCredentialForm((current) => ({ ...current, service: event.target.value }))} placeholder="GitHub, Meta Ads, Hostinger..." />
            </div>

            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={credentialForm.url} onChange={(event) => setCredentialForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input value={credentialForm.username} onChange={(event) => setCredentialForm((current) => ({ ...current, username: event.target.value }))} placeholder="email ou login" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Senha / segredo</Label>
              <Input value={credentialForm.password} onChange={(event) => setCredentialForm((current) => ({ ...current, password: event.target.value }))} placeholder="valor secreto" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observacoes</Label>
              <Textarea value={credentialForm.notes} onChange={(event) => setCredentialForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px]" placeholder="Contexto, responsavel, observacoes de acesso..." />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCredentialDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveCredential()} disabled={mutating}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supabaseDialogOpen} onOpenChange={setSupabaseDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editingSupabaseInstance ? "Editar instancia Supabase" : "Nova instancia Supabase"}</DialogTitle>
            <DialogDescription>Cadastro por projeto com keepalive e pacote completo de credenciais do Supabase.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={supabaseForm.projectValue} onValueChange={(value) => setSupabaseForm((current) => ({ ...current, projectValue: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_PROJECT_VALUE}>{GENERAL_PROJECT_LABEL}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Repositorio</Label>
              <Select value={supabaseForm.repositoryId} onValueChange={(value) => setSupabaseForm((current) => ({ ...current, repositoryId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem repositorio</SelectItem>
                  {repositories
                    .filter((repository) => (selectedProjectId ? repository.project_id === selectedProjectId : !repository.project_id))
                    .map((repository) => (
                      <SelectItem key={repository.id} value={repository.id}>{repository.repo_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2"><Label>Nome interno</Label><Input value={supabaseForm.displayName} onChange={(event) => setSupabaseForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="workos-26 production" /></div>
            <div className="space-y-2"><Label>Project ref</Label><Input value={supabaseForm.projectRef} onChange={(event) => setSupabaseForm((current) => ({ ...current, projectRef: event.target.value }))} placeholder="abcdefghijklmnop" /></div>
            <div className="space-y-2"><Label>Project URL</Label><Input value={supabaseForm.projectUrl} onChange={(event) => setSupabaseForm((current) => ({ ...current, projectUrl: event.target.value }))} placeholder="https://supabase.com/dashboard/project/..." /></div>
            <div className="space-y-2"><Label>API URL</Label><Input value={supabaseForm.apiUrl} onChange={(event) => setSupabaseForm((current) => ({ ...current, apiUrl: event.target.value }))} placeholder="https://xxxx.supabase.co" /></div>

            <div className="space-y-2">
              <Label>Tipo de keepalive</Label>
              <Select value={supabaseForm.keepaliveType} onValueChange={(value: "rest" | "sql") => setSupabaseForm((current) => ({ ...current, keepaliveType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest">REST ping</SelectItem>
                  <SelectItem value="sql">SQL ping</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2"><Label>Intervalo (horas)</Label><Input value={supabaseForm.keepaliveIntervalHours} onChange={(event) => setSupabaseForm((current) => ({ ...current, keepaliveIntervalHours: event.target.value }))} placeholder="24" /></div>

            <div className="space-y-2"><Label>Email da conta</Label><Input value={supabaseForm.email} onChange={(event) => setSupabaseForm((current) => ({ ...current, email: event.target.value }))} placeholder="voce@empresa.com" /></div>
            <div className="space-y-2"><Label>Anon key</Label><Input value={supabaseForm.anonKey} onChange={(event) => setSupabaseForm((current) => ({ ...current, anonKey: event.target.value }))} placeholder="eyJ..." /></div>
            <div className="space-y-2"><Label>Service role key</Label><Input value={supabaseForm.serviceRoleKey} onChange={(event) => setSupabaseForm((current) => ({ ...current, serviceRoleKey: event.target.value }))} placeholder="eyJ..." /></div>
            <div className="space-y-2"><Label>Access token</Label><Input value={supabaseForm.accessToken} onChange={(event) => setSupabaseForm((current) => ({ ...current, accessToken: event.target.value }))} placeholder="sbp_... / token pessoal" /></div>
            <div className="space-y-2"><Label>Management token</Label><Input value={supabaseForm.managementToken} onChange={(event) => setSupabaseForm((current) => ({ ...current, managementToken: event.target.value }))} placeholder="token administrativo / automacao" /></div>
            <div className="space-y-2"><Label>Database URL</Label><Input value={supabaseForm.databaseUrl} onChange={(event) => setSupabaseForm((current) => ({ ...current, databaseUrl: event.target.value }))} placeholder="postgresql://..." /></div>
            <div className="space-y-2"><Label>Senha do banco</Label><Input value={supabaseForm.databasePassword} onChange={(event) => setSupabaseForm((current) => ({ ...current, databasePassword: event.target.value }))} placeholder="senha do Postgres" /></div>
            <div className="space-y-2"><Label>Senha da conta Supabase</Label><Input value={supabaseForm.supabasePassword} onChange={(event) => setSupabaseForm((current) => ({ ...current, supabasePassword: event.target.value }))} placeholder="senha do login Supabase" /></div>

            <div className="space-y-2 sm:col-span-2 xl:col-span-3"><Label>Observacoes</Label><Textarea value={supabaseForm.notes} onChange={(event) => setSupabaseForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px]" placeholder="Escopo, ambiente, responsavel, observacoes de manutencao..." /></div>

            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Label>Status</Label>
              <Select value={supabaseForm.keepaliveEnabled ? "active" : "paused"} onValueChange={(value) => setSupabaseForm((current) => ({ ...current, keepaliveEnabled: value === "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Keepalive ativo</SelectItem>
                  <SelectItem value="paused">Keepalive pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSupabaseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveSupabaseInstance()} disabled={mutating}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Conectar GitHub</DialogTitle>
            <DialogDescription>Use um token pessoal com acesso a `repo` e leitura de organizações para sincronizar os projetos remotos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da conexão</Label>
              <Input
                value={githubConnectionForm.displayName}
                onChange={(event) => setGithubConnectionForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="GitHub principal"
              />
            </div>

            <div className="space-y-2">
              <Label>Token GitHub</Label>
              <Textarea
                value={githubConnectionForm.token}
                onChange={(event) => setGithubConnectionForm((current) => ({ ...current, token: event.target.value }))}
                className="min-h-[140px] font-mono"
                placeholder="ghp_... ou github_pat_..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGithubDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void connectGithub()} disabled={mutating}>
              <Save className="mr-2 h-4 w-4" />
              Validar e conectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteCredential}
        onOpenChange={(open) => {
          if (!open) setDeleteCredential(null);
        }}
        itemLabel={deleteCredential?.service || "esta credencial"}
        onConfirm={() => void deleteCredentialEntry()}
      />
    </div>
  );
}
