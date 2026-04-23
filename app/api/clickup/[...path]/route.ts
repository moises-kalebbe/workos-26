import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { ensureDatabaseConnection, sql } from "@/lib/db";

export const runtime = "nodejs";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

async function getUserToken(userId: string): Promise<string | null> {
  await ensureDatabaseConnection();
  const rows = await sql<{ clickup_token: string | null }[]>`
    SELECT clickup_token FROM profiles WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.clickup_token ?? null;
}

async function proxyToClickUp(
  token: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const url = `${CLICKUP_BASE}/${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
  };
  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }
  return fetch(url, init);
}

function buildPath(segments: string[]): string {
  return segments.join("/");
}

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const user = await getRequestUser(request);
  if (!user) {
    const res = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(res.headers);
    return res;
  }

  const token = await getUserToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "clickup_not_configured" }, { status: 401 });
  }

  const path = buildPath(params.path);
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const fullPath = qs ? `${path}?${qs}` : path;

  try {
    const upstream = await proxyToClickUp(token, fullPath, "GET");
    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao conectar ao ClickUp" }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  const user = await getRequestUser(request);
  if (!user) {
    const res = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(res.headers);
    return res;
  }

  const token = await getUserToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "clickup_not_configured" }, { status: 401 });
  }

  const path = buildPath(params.path);
  const body = await request.json().catch(() => ({}));

  try {
    const upstream = await proxyToClickUp(token, path, "POST", body);
    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Erro ao conectar ao ClickUp" }, { status: 502 });
  }
}

export async function PUT(request: Request, { params }: { params: { path: string[] } }) {
  const user = await getRequestUser(request);
  if (!user) {
    const res = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(res.headers);
    return res;
  }

  const token = await getUserToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "clickup_not_configured" }, { status: 401 });
  }

  const path = buildPath(params.path);
  const body = await request.json().catch(() => ({}));

  try {
    const upstream = await proxyToClickUp(token, path, "PUT", body);
    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Erro ao conectar ao ClickUp" }, { status: 502 });
  }
}
