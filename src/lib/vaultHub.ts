import type { Project } from "@/types";
import { GENERAL_PROJECT_LABEL } from "@/config/constants";

export type VaultHubTab =
  | "overview"
  | "credentials"
  | "repositories"
  | "environments"
  | "imports";

export type VaultEnvironmentScope = "local" | "development" | "production" | "staging" | "unknown";

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

export type VaultSyncRunRecord = {
  id: string;
  user_id: string;
  project_id: string | null;
  repository_id: string | null;
  run_type: "repo_scan" | "env_scan" | "windows_notes_import" | "github_sync";
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

export function decodeSecret(value: string) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
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

  if (normalized.includes("postgres") || normalized === "database_url") return "postgres";
  if (normalized.includes("clerk")) return "clerk";
  if (normalized.includes("google")) return "google";
  if (normalized.includes("github")) return "github";
  if (normalized.includes("vercel")) return "vercel";

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
    value === "imports"
  ) {
    return value;
  }

  return "overview";
}
