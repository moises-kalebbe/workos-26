import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { createServerDbClient } from "@/lib/serverDbClient";
import { encodeSecret } from "@/lib/vaultHub";

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "workos-vault-github-sync",
};

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
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : "GitHub principal";

  if (!token) {
    return NextResponse.json({ error: "Informe um token do GitHub." }, { status: 400 });
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return NextResponse.json({ error: "Token GitHub invalido ou sem permissao." }, { status: 400 });
  }

  const githubUser = (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
  };

  const scopeHeader = userResponse.headers.get("x-oauth-scopes") || "";
  const scopes = scopeHeader
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const encoded = encodeSecret(token);
  const upsertRes = await db
    .from("vault_github_connections")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        encrypted_token: encoded.encrypted,
        iv: encoded.iv,
        github_user_id: String(githubUser.id),
        github_login: githubUser.login,
        github_name: githubUser.name || null,
        avatar_url: githubUser.avatar_url || null,
        scopes,
        is_active: true,
      },
      { onConflict: "user_id,github_login" },
    )
    .select("*")
    .single();

  if (upsertRes.error) {
    return NextResponse.json({ error: upsertRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    connection: upsertRes.data,
    profile: {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name || null,
      avatarUrl: githubUser.avatar_url || null,
      scopes,
    },
  });
}
