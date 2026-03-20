import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/requestUser";
import {
  decodeSecret,
  detectSupabaseFromEnvRows,
  detectSupabaseFromToml,
  extractSupabaseProjectRef,
  parseEnvFileContent,
  resolveProjectAssociation,
  type GithubSupabaseDetection,
} from "@/lib/vaultHub";
import type { Project } from "@/types";

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "workos-vault-github-sync",
};

type GithubRepository = {
  id: number;
  name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
};

type GithubTreeResponse = {
  tree: Array<{
    path: string;
    type: "blob" | "tree";
    sha: string;
  }>;
};

type GithubBlobResponse = {
  content?: string;
  encoding?: string;
};

async function fetchGithubJson<T>(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub respondeu com status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function fetchGithubBlobContent(token: string, owner: string, repo: string, sha: string) {
  const blob = await fetchGithubJson<GithubBlobResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
    token,
  );

  if (blob.encoding !== "base64" || !blob.content) {
    return "";
  }

  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function isCandidateSupabasePath(path: string) {
  const normalized = path.toLowerCase();

  if (normalized === "supabase/config.toml") return true;
  if (normalized.endsWith("/supabase/config.toml")) return true;
  if (normalized === ".env" || normalized.startsWith(".env.")) return true;
  if (normalized.endsWith("/.env") || normalized.includes("/.env.")) return true;
  if (normalized.endsWith(".env.example") || normalized.endsWith(".env.sample")) return true;
  if (normalized.endsWith("readme.md")) return true;
  if (normalized.includes("supabase")) return true;
  if (normalized.includes("env")) return true;
  if (normalized.includes("docs/")) return true;

  return false;
}

async function detectSupabaseInGithubRepository(
  token: string,
  repository: GithubRepository,
): Promise<GithubSupabaseDetection> {
  const owner = repository.owner?.login;
  if (!owner || !repository.default_branch) {
    return { detected: false, projectRef: null, projectUrl: null, apiUrl: null, evidence: [] };
  }

  const tree = await fetchGithubJson<GithubTreeResponse>(
    `https://api.github.com/repos/${owner}/${repository.name}/git/trees/${repository.default_branch}?recursive=1`,
    token,
  );

  const candidateFiles = tree.tree
    .filter((item) => item.type === "blob" && isCandidateSupabasePath(item.path))
    .slice(0, 20);

  if (candidateFiles.length === 0) {
    return { detected: false, projectRef: null, projectUrl: null, apiUrl: null, evidence: [] };
  }

  const evidence = new Set<string>();
  let projectRef: string | null = null;
  let apiUrl: string | null = null;
  let projectUrl: string | null = null;

  for (const file of candidateFiles) {
    const content = await fetchGithubBlobContent(token, owner, repository.name, file.sha);
    if (!content) continue;

    const normalizedPath = file.path.toLowerCase();

    if (normalizedPath.endsWith("config.toml")) {
      const tomlDetection = detectSupabaseFromToml(repository.name, content);
      if (tomlDetection) {
        evidence.add(file.path);
        projectRef ||= tomlDetection.projectRef;
        apiUrl ||= tomlDetection.apiUrl;
        projectUrl ||= tomlDetection.projectUrl;
      }
    }

    if (normalizedPath.includes(".env")) {
      const envDetection = detectSupabaseFromEnvRows(repository.name, parseEnvFileContent(content));
      if (envDetection) {
        evidence.add(file.path);
        projectRef ||= envDetection.projectRef;
        apiUrl ||= envDetection.apiUrl;
        projectUrl ||= envDetection.projectUrl;
      }
    }

    if (/supabase|supabase\.co|service_role|anon key|anon_key|project_ref/i.test(content)) {
      evidence.add(file.path);
      const extractedProjectRef = extractSupabaseProjectRef(content);
      if (extractedProjectRef) {
        projectRef ||= extractedProjectRef;
      }

      const urlMatch = content.match(/https:\/\/[a-z0-9-]+\.supabase\.co/gi)?.[0] || null;
      if (urlMatch) {
        apiUrl ||= urlMatch;
      }
    }
  }

  if (!projectRef && apiUrl) {
    projectRef = extractSupabaseProjectRef(apiUrl);
  }

  if (projectRef && !projectUrl) {
    projectUrl = `https://supabase.com/dashboard/project/${projectRef}`;
  }

  if (projectRef && !apiUrl) {
    apiUrl = `https://${projectRef}.supabase.co`;
  }

  return {
    detected: evidence.size > 0,
    projectRef,
    projectUrl,
    apiUrl,
    evidence: [...evidence].sort(),
  };
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient() as any;
  const user = await getRequestUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionRes = await supabase
    .from("vault_github_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionRes.error) {
    return NextResponse.json({ error: connectionRes.error.message }, { status: 500 });
  }

  if (!connectionRes.data) {
    return NextResponse.json({ error: "Conecte uma conta GitHub antes de sincronizar." }, { status: 400 });
  }

  const token = decodeSecret(connectionRes.data.encrypted_token);
  if (!token) {
    return NextResponse.json({ error: "Token GitHub invalido na conexao armazenada." }, { status: 400 });
  }

  try {
    const projectsRes = await supabase.from("projects").select("*").order("name");
    if (projectsRes.error) {
      throw new Error(projectsRes.error.message);
    }

    const projects = (projectsRes.data || []) as Project[];
    const userRepos = await fetchGithubJson<GithubRepository[]>(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      token,
    );
    const orgs = await fetchGithubJson<Array<{ login: string }>>(
      "https://api.github.com/user/orgs?per_page=100",
      token,
    );

    const orgReposNested = await Promise.all(
      orgs.map((org) =>
        fetchGithubJson<GithubRepository[]>(
          `https://api.github.com/orgs/${org.login}/repos?per_page=100&sort=updated`,
          token,
        ),
      ),
    );

    const repositories = [...userRepos, ...orgReposNested.flat()];
    const uniqueRepositories = [
      ...new Map(repositories.map((repository) => [String(repository.id), repository])).values(),
    ];

    const detections = await Promise.all(
      uniqueRepositories.map((repository) => detectSupabaseInGithubRepository(token, repository)),
    );

    const rows = uniqueRepositories.map((repository, index) => ({
      user_id: user.id,
      project_id: resolveProjectAssociation(projects, {
        repoName: repository.name,
        ownerName: repository.owner?.login || null,
      }),
      local_path: `github://${repository.owner?.login || "unknown"}/${repository.name}`,
      remote_url: repository.clone_url,
      html_url: repository.html_url,
      repo_name: repository.name,
      owner_name: repository.owner?.login || null,
      provider: "github",
      source_type: "github_sync",
      external_id: String(repository.id),
      is_remote_only: true,
      default_branch: repository.default_branch || null,
      detected_environment_count: 0,
      supabase_detected: detections[index]?.detected || false,
      supabase_project_ref: detections[index]?.projectRef || null,
      supabase_project_url: detections[index]?.projectUrl || null,
      supabase_api_url: detections[index]?.apiUrl || null,
      supabase_detection_evidence: detections[index]?.evidence || [],
      supabase_detection_scanned_at: new Date().toISOString(),
      last_scanned_at: new Date().toISOString(),
      last_scan_status: "success",
      notes: "Sincronizado automaticamente via GitHub API.",
    }));
    const detectedSupabaseRepositories = uniqueRepositories
      .map((repository, index) => ({
        repo: repository.name,
        owner: repository.owner?.login || null,
        project_ref: detections[index]?.projectRef || null,
        evidence: detections[index]?.evidence || [],
      }))
      .filter((repository) => repository.evidence.length > 0);

    if (rows.length > 0) {
      const upsertRes = await supabase
        .from("vault_repositories")
        .upsert(rows, { onConflict: "user_id,provider,external_id" });

      if (upsertRes.error) {
        throw new Error(upsertRes.error.message);
      }
    }

    const syncedAt = new Date().toISOString();
    await supabase
      .from("vault_github_connections")
      .update({
        last_synced_at: syncedAt,
        last_sync_status: "success",
      })
      .eq("id", connectionRes.data.id);

    await supabase.from("vault_sync_runs").insert({
      user_id: user.id,
      run_type: "github_sync",
      status: "success",
      summary: `${rows.length} repositorio(s) sincronizado(s) do GitHub, ${detections.filter((item) => item.detected).length} com Supabase detectado.`,
      details: {
        github_login: connectionRes.data.github_login,
        supabase_detected_repositories: detectedSupabaseRepositories,
      },
    });

    return NextResponse.json({
      synced: rows.length,
      githubLogin: connectionRes.data.github_login,
      supabaseDetected: detections.filter((item) => item.detected).length,
    });
  } catch (error) {
    await supabase
      .from("vault_github_connections")
      .update({
        last_sync_status: "error",
      })
      .eq("id", connectionRes.data.id);

    return NextResponse.json(
      { error: (error as Error).message || "Falha ao sincronizar GitHub." },
      { status: 500 },
    );
  }
}
