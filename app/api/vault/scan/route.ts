import { NextResponse } from "next/server";
import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { createServerDbClient } from "@/lib/serverDbClient";
import {
  detectProviderFromEnvKey,
  encodeSecret,
  inferEnvironmentScope,
  parseEnvFileContent,
  parseRemoteUrl,
  resolveProjectAssociation,
  type LocalEnvironmentScanResult,
  type LocalRepositoryScanResult,
  type WindowsNoteSourceDetection,
} from "@/lib/vaultHub";
import type { Project } from "@/types";

const ENV_FILE_NAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
];

async function pathExists(pathValue: string) {
  try {
    await access(pathValue, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectGitRepositories(rootPath: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
  const repositories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = join(rootPath, entry.name);
    if (entry.name === ".git") {
      repositories.push(rootPath);
      continue;
    }
    const childRepos = await collectGitRepositories(fullPath, depth + 1);
    repositories.push(...childRepos);
  }

  return [...new Set(repositories)];
}

function runGit(args: string[], repoPath: string) {
  try {
    return execFileSync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function scanRepository(repoPath: string): Promise<{
  repository: LocalRepositoryScanResult;
  environments: LocalEnvironmentScanResult[];
}> {
  const remoteUrl = runGit(["remote", "get-url", "origin"], repoPath);
  const defaultBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  const remoteMeta = parseRemoteUrl(remoteUrl);
  const repoName = remoteMeta.repoName || repoPath.split(/[/\\]/).filter(Boolean).pop() || "repo";

  const environments: LocalEnvironmentScanResult[] = [];
  const files = await readdir(repoPath, { withFileTypes: true }).catch(() => []);

  for (const file of files) {
    if (!file.isFile()) continue;
    if (!ENV_FILE_NAMES.includes(file.name) && !/^\.env\..+\.local$/i.test(file.name)) continue;

    const sourcePath = join(repoPath, file.name);
    const content = await readFile(sourcePath, "utf8").catch(() => "");
    const rows = parseEnvFileContent(content);
    rows.forEach((row) => {
      environments.push({
        repositoryLocalPath: repoPath,
        envKey: row.envKey,
        envValue: row.envValue,
        envScope: inferEnvironmentScope(file.name),
        sourcePath,
        detectedProvider: detectProviderFromEnvKey(row.envKey),
      });
    });
  }

  return {
    repository: {
      localPath: repoPath,
      remoteUrl,
      repoName,
      ownerName: remoteMeta.ownerName,
      provider: remoteMeta.provider,
      defaultBranch,
    },
    environments,
  };
}

function detectWindowsNoteSources(): WindowsNoteSourceDetection[] {
  const home = homedir();
  return [
    {
      key: "sticky-notes",
      label: "Sticky Notes",
      path: join(home, "AppData", "Local", "Packages", "Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe"),
      supported: false,
      note: "Detecta a instalacao. Importacao automatica depende do formato real do app.",
    },
    {
      key: "notepad",
      label: "Notepad",
      path: join(home, "AppData", "Local", "Packages", "Microsoft.WindowsNotepad_8wekyb3d8bbwe"),
      supported: false,
      note: "Serve para descoberta. Importacao automatica sera feita por arquivo/export manual.",
    },
  ];
}

function getDefaultScanRoot() {
  const configuredRoot = process.env.VAULT_SCAN_ROOT?.trim();
  if (configuredRoot) return configuredRoot;

  return join(homedir(), "GitHub");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    appendClerkResetHeaders(response.headers);
    return response;
  }

  const db = createServerDbClient(user.id) as any;
  const body = await request.json().catch(() => ({}));
  const rootPath = typeof body.rootPath === "string" && body.rootPath.trim() ? body.rootPath.trim() : getDefaultScanRoot();

  const projectsRes = await db.from("projects").select("*").order("name");
  if (projectsRes.error) {
    return NextResponse.json({ error: projectsRes.error.message }, { status: 500 });
  }

  const projects = (projectsRes.data || []) as Project[];
  const repoPaths = (await pathExists(rootPath)) ? await collectGitRepositories(rootPath) : [];
  const scanned = await Promise.all(repoPaths.map((repoPath) => scanRepository(repoPath)));

  const repoRows = scanned.map(({ repository, environments }) => ({
    user_id: user.id,
    project_id: resolveProjectAssociation(projects, repository),
    local_path: repository.localPath,
    remote_url: repository.remoteUrl,
    html_url: repository.remoteUrl,
    repo_name: repository.repoName,
    owner_name: repository.ownerName,
    provider: repository.provider,
    source_type: "local_scan",
    external_id: null,
    is_remote_only: false,
    default_branch: repository.defaultBranch,
    detected_environment_count: environments.length,
    last_scanned_at: new Date().toISOString(),
    last_scan_status: "success",
    notes: "Escaneado automaticamente a partir do workspace local.",
  }));

  if (repoRows.length > 0) {
    const repoUpsert = await db
      .from("vault_repositories")
      .upsert(repoRows, { onConflict: "user_id,local_path" })
      .select("*");

    if (repoUpsert.error) {
      return NextResponse.json({ error: repoUpsert.error.message }, { status: 500 });
    }

    const repositories = repoUpsert.data || [];
    const repoIdByPath = new Map(repositories.map((repo: any) => [repo.local_path, repo.id]));
    const repoProjectByPath = new Map(repositories.map((repo: any) => [repo.local_path, repo.project_id]));

    const envRows = scanned.flatMap(({ repository, environments }) =>
      environments.map((env) => {
        const encoded = encodeSecret(env.envValue);
        return {
          user_id: user.id,
          repository_id: repoIdByPath.get(repository.localPath) || null,
          project_id: repoProjectByPath.get(repository.localPath) || null,
          env_key: env.envKey,
          env_scope: env.envScope,
          source_path: env.sourcePath,
          encrypted_value: encoded.encrypted,
          iv: encoded.iv,
          detected_provider: env.detectedProvider,
        };
      }),
    );

    if (envRows.length > 0) {
      const envUpsert = await db
        .from("vault_environment_entries")
        .upsert(envRows, { onConflict: "user_id,repository_id,env_key,source_path" });

      if (envUpsert.error) {
        return NextResponse.json({ error: envUpsert.error.message }, { status: 500 });
      }
    }

    await db.from("vault_sync_runs").insert([
      {
        user_id: user.id,
        run_type: "repo_scan",
        status: "success",
        summary: `${repoRows.length} repositorio(s) local(is) escaneado(s).`,
        details: { rootPath },
      },
      {
        user_id: user.id,
        run_type: "env_scan",
        status: "success",
        summary: `${scanned.reduce((acc, item) => acc + item.environments.length, 0)} env(s) detectada(s).`,
        details: { rootPath },
      },
    ]);
  }

  return NextResponse.json({
    repositories: scanned.map((item) => item.repository),
    environmentEntries: scanned.flatMap((item) => item.environments),
    windowsNoteSources: detectWindowsNoteSources(),
  });
}
