import type { Project } from "@/types";
import { GENERAL_PROJECT_LABEL } from "@/config/constants";

export type VaultHubTab =
  | "overview"
  | "credentials"
  | "repositories"
  | "environments"
  | "supabase"
  | "imports";

export type VaultEnvironmentScope = "local" | "development" | "production" | "staging" | "unknown";
export type VaultKeepaliveType = "rest" | "sql";

export type VaultRepositoryRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  local_path: string;
  remote_url: string | null;
  html_url?: string | null;
  repo_name: string;
  owner_name: string | null;
  provider: string;
  source_type?: "local_scan" | "github_sync";
  external_id?: string | null;
  is_remote_only?: boolean;
  default_branch: string | null;
  detected_environment_count: number;
  supabase_detected?: boolean;
  supabase_project_ref?: string | null;
  supabase_project_url?: string | null;
  supabase_api_url?: string | null;
  supabase_detection_evidence?: string[];
  supabase_detection_scanned_at?: string | null;
  last_scanned_at: string | null;
  last_scan_status: "idle" | "success" | "error";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultEnvironmentEntryRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  env_key: string;
  env_scope: VaultEnvironmentScope;
  source_path: string;
  encrypted_value: string;
  iv: string;
  detected_provider: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultSupabaseInstanceRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  display_name: string;
  project_ref: string | null;
  project_url: string | null;
  api_url: string | null;
  keepalive_type: VaultKeepaliveType;
  keepalive_enabled: boolean;
  keepalive_interval_hours: number;
  encrypted_credential: string | null;
  credential_iv: string | null;
  encrypted_credentials_payload?: string | null;
  credentials_payload_iv?: string | null;
  last_keepalive_at: string | null;
  last_keepalive_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultSupabaseCredentialsPayload = {
  email: string;
  anonKey: string;
  serviceRoleKey: string;
  accessToken: string;
  managementToken: string;
  databaseUrl: string;
  databasePassword: string;
  supabasePassword: string;
};

export type VaultSyncRunRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  supabase_instance_id: string | null;
  run_type: "repo_scan" | "env_scan" | "keepalive" | "windows_notes_import" | "github_sync";
  status: "success" | "error" | "skipped";
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type VaultGithubConnectionRecord = {
  id: string;
  user_id: string;
  display_name: string;
  encrypted_token: string;
  iv: string;
  github_user_id: string | null;
  github_login: string;
  github_name: string | null;
  avatar_url: string | null;
  scopes: string[];
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  created_at: string;
  updated_at: string;
};

export type LocalRepositoryScanResult = {
  localPath: string;
  remoteUrl: string | null;
  repoName: string;
  ownerName: string | null;
  provider: string;
  defaultBranch: string | null;
};

export type LocalEnvironmentScanResult = {
  repositoryLocalPath: string;
  envKey: string;
  envValue: string;
  envScope: VaultEnvironmentScope;
  sourcePath: string;
  detectedProvider: string | null;
};

export type LocalSupabaseDetection = {
  repositoryLocalPath: string;
  displayName: string;
  projectRef: string | null;
  projectUrl: string | null;
  apiUrl: string | null;
  suggestedCredential: string | null;
};

export type GithubSupabaseDetection = {
  detected: boolean;
  projectRef: string | null;
  projectUrl: string | null;
  apiUrl: string | null;
  evidence: string[];
};

export type WindowsNoteSourceDetection = {
  key: string;
  label: string;
  path: string;
  supported: boolean;
  note: string;
};

export function encodeSecret(value: string) {
  return {
    encrypted: Buffer.from(value, "utf8").toString("base64"),
    iv: crypto.randomUUID(),
  };
}

export function encodeSecretPayload<T extends Record<string, string>>(value: T) {
  return encodeSecret(JSON.stringify(value));
}

export function decodeSecret(value: string) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function decodeSecretPayload<T extends Record<string, string>>(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(decodeSecret(value)) as T;
  } catch {
    return null;
  }
}

export function decodeBrowserSecret(value: string) {
  try {
    return atob(value);
  } catch {
    return "";
  }
}

export function encodeBrowserSecret(value: string) {
  return {
    encrypted: btoa(value),
    iv: crypto.randomUUID(),
  };
}

export function encodeBrowserSecretPayload<T extends Record<string, string>>(value: T) {
  return encodeBrowserSecret(JSON.stringify(value));
}

export function decodeBrowserSecretPayload<T extends Record<string, string>>(value: string | null | undefined) {
  if (!value) return null;

  try {
    const decoded = decodeBrowserSecret(value);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function parseRemoteUrl(remoteUrl: string | null) {
  if (!remoteUrl) {
    return { ownerName: null, repoName: null, provider: "github" };
  }

  const normalized = remoteUrl.trim();
  const sshMatch = normalized.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  const httpsMatch = normalized.match(/https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  const match = sshMatch || httpsMatch;

  if (!match) {
    return { ownerName: null, repoName: null, provider: "custom" };
  }

  return {
    ownerName: match[1] || null,
    repoName: match[2] || null,
    provider: "github",
  };
}

export function inferEnvironmentScope(sourcePath: string): VaultEnvironmentScope {
  const pathValue = sourcePath.toLowerCase();
  if (pathValue.includes(".env.production")) return "production";
  if (pathValue.includes(".env.development")) return "development";
  if (pathValue.includes(".env.staging")) return "staging";
  if (pathValue.includes(".env.local")) return "local";
  if (pathValue.endsWith(".env")) return "unknown";
  return "unknown";
}

export function parseEnvFileContent(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) return null;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const envValue = rawValue.replace(/^['"]|['"]$/g, "");
      if (!key) return null;
      return { envKey: key, envValue };
    })
    .filter((row): row is { envKey: string; envValue: string } => !!row);
}

export function detectProviderFromEnvKey(envKey: string) {
  const normalized = envKey.toLowerCase();
  if (normalized.includes("supabase")) return "supabase";
  if (normalized.includes("vercel")) return "vercel";
  if (normalized.includes("github")) return "github";
  return null;
}

export function detectSupabaseFromEnvRows(
  repositoryLocalPath: string,
  rows: { envKey: string; envValue: string }[],
) {
  const byKey = new Map(rows.map((row) => [row.envKey, row.envValue]));
  const projectRef =
    byKey.get("NEXT_PUBLIC_SUPABASE_PROJECT_REF") ||
    byKey.get("SUPABASE_PROJECT_REF") ||
    null;
  const apiUrl =
    byKey.get("NEXT_PUBLIC_SUPABASE_URL") ||
    byKey.get("SUPABASE_URL") ||
    null;
  const suggestedCredential =
    byKey.get("SUPABASE_SERVICE_ROLE_KEY") ||
    byKey.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    byKey.get("SUPABASE_ANON_KEY") ||
    null;

  if (!projectRef && !apiUrl && !suggestedCredential) {
    return null;
  }

  const displayName = repositoryLocalPath.split(/[/\\]/).filter(Boolean).pop() || "Supabase";
  const normalizedApiUrl = apiUrl || (projectRef ? `https://${projectRef}.supabase.co` : null);
  const projectUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : null;

  return {
    repositoryLocalPath,
    displayName,
    projectRef,
    projectUrl,
    apiUrl: normalizedApiUrl,
    suggestedCredential,
  } satisfies LocalSupabaseDetection;
}

export function detectSupabaseFromToml(
  repositoryLocalPath: string,
  tomlContent: string,
) {
  const projectRefMatch = tomlContent.match(/project_id\s*=\s*"([^"]+)"/i);
  if (!projectRefMatch) return null;

  const projectRef = projectRefMatch[1] || null;
  if (!projectRef) return null;

  return {
    repositoryLocalPath,
    displayName: `${repositoryLocalPath.split(/[/\\]/).filter(Boolean).pop() || "Supabase"} Supabase`,
    projectRef,
    projectUrl: `https://supabase.com/dashboard/project/${projectRef}`,
    apiUrl: `https://${projectRef}.supabase.co`,
    suggestedCredential: null,
  } satisfies LocalSupabaseDetection;
}

export function extractSupabaseProjectRef(value: string | null) {
  if (!value) return null;

  const directMatch = value.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (directMatch?.[1]) return directMatch[1];

  const dashboardMatch = value.match(/project\/([a-z0-9-]+)/i);
  if (dashboardMatch?.[1]) return dashboardMatch[1];

  const normalized = value.trim();
  if (/^[a-z0-9-]{6,}$/i.test(normalized) && !normalized.includes("/")) {
    return normalized;
  }

  return null;
}

export function resolveProjectAssociation(
  projects: Project[],
  repository: Pick<LocalRepositoryScanResult, "repoName" | "ownerName">,
) {
  const normalizedRepo = repository.repoName.toLowerCase();
  const normalizedOwner = (repository.ownerName || "").toLowerCase();

  const directMatch = projects.find((project) => {
    const name = project.name.toLowerCase();
    const client = (project.client || "").toLowerCase();
    return (
      normalizedRepo.includes(name) ||
      name.includes(normalizedRepo) ||
      (!!client && (normalizedOwner.includes(client) || client.includes(normalizedOwner)))
    );
  });

  return directMatch?.id || null;
}

export function getCompanyOptionLabel(project: Project | null) {
  return project?.name || GENERAL_PROJECT_LABEL;
}

export function getInitialTab(value: string | null): VaultHubTab {
  if (
    value === "overview" ||
    value === "credentials" ||
    value === "repositories" ||
    value === "environments" ||
    value === "supabase" ||
    value === "imports"
  ) {
    return value;
  }

  return "overview";
}
