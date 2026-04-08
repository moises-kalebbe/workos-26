import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { createServerDbClient } from "@/lib/serverDbClient";
import {
  decodeSecret,
  resolveProjectAssociation,
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

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    appendClerkResetHeaders(response.headers);
    return response;
  }

  const db = createServerDbClient(user.id) as any;
  const connectionRes = await db
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
    return NextResponse.json({ error: "Token GitHub invalido na conexão armazenada." }, { status: 400 });
  }

  try {
    const projectsRes = await db.from("projects").select("*").order("name");
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

    const rows = uniqueRepositories.map((repository) => ({
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
      last_scanned_at: new Date().toISOString(),
      last_scan_status: "success",
      notes: "Sincronizado automaticamente via GitHub API.",
    }));

    if (rows.length > 0) {
      const upsertRes = await db
        .from("vault_repositories")
        .upsert(rows, { onConflict: "user_id,provider,external_id" });

      if (upsertRes.error) {
        throw new Error(upsertRes.error.message);
      }
    }

    const syncedAt = new Date().toISOString();
    await db
      .from("vault_github_connections")
      .update({
        last_synced_at: syncedAt,
        last_sync_status: "success",
      })
      .eq("id", connectionRes.data.id);

    await db.from("vault_sync_runs").insert({
      user_id: user.id,
      run_type: "github_sync",
      status: "success",
      summary: `${rows.length} repositorio(s) sincronizado(s) do GitHub.`,
      details: {
        github_login: connectionRes.data.github_login,
      },
    });

    return NextResponse.json({
      synced: rows.length,
      githubLogin: connectionRes.data.github_login,
    });
  } catch (error) {
    await db
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
