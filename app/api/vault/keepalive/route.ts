import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/requestUser";
import { decodeSecret, decodeSecretPayload, type VaultSupabaseCredentialsPayload } from "@/lib/vaultHub";

export const runtime = "nodejs";

async function pingSupabase(instance: any) {
  if (!instance.api_url) {
    return { status: "skipped", summary: "Instancia sem api_url configurada." };
  }

  if (instance.keepalive_type === "sql") {
    return { status: "skipped", summary: "Modo SQL ainda nao disponivel nesta fase." };
  }

  const credentialsPayload = decodeSecretPayload<VaultSupabaseCredentialsPayload>(
    instance.encrypted_credentials_payload,
  );
  const credential =
    credentialsPayload?.serviceRoleKey ||
    credentialsPayload?.anonKey ||
    (instance.encrypted_credential ? decodeSecret(instance.encrypted_credential) : "");
  const headers: Record<string, string> = {};
  if (credential) {
    headers.apikey = credential;
    headers.Authorization = `Bearer ${credential}`;
  }

  try {
    const response = await fetch(`${instance.api_url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { status: "error", summary: `REST ping falhou com status ${response.status}.` };
    }

    return { status: "success", summary: "REST ping executado com sucesso." };
  } catch (error) {
    return { status: "error", summary: (error as Error).message || "Falha no keepalive." };
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient() as any;
  const user = await getRequestUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const onlyInstanceId = typeof body.instanceId === "string" ? body.instanceId : null;

  let query = supabase
    .from("vault_supabase_instances")
    .select("*")
    .eq("user_id", user.id)
    .eq("keepalive_enabled", true);

  if (onlyInstanceId) {
    query = query.eq("id", onlyInstanceId);
  }

  const instancesRes = await query;
  if (instancesRes.error) {
    return NextResponse.json({ error: instancesRes.error.message }, { status: 500 });
  }

  const results: Array<{
    id: string;
    displayName: string;
    status: string;
    summary: string;
    executedAt: string;
  }> = [];
  for (const instance of instancesRes.data || []) {
    const result = await pingSupabase(instance);
    const timestamp = new Date().toISOString();

    await supabase
      .from("vault_supabase_instances")
      .update({
        last_keepalive_at: timestamp,
        last_keepalive_status: result.status,
      })
      .eq("id", instance.id);

    await supabase.from("vault_sync_runs").insert({
      user_id: user.id,
      project_id: instance.project_id,
      repository_id: instance.repository_id,
      supabase_instance_id: instance.id,
      run_type: "keepalive",
      status: result.status,
      summary: result.summary,
      details: {
        keepaliveType: instance.keepalive_type,
        apiUrl: instance.api_url,
      },
    });

    results.push({
      id: instance.id,
      displayName: instance.display_name,
      ...result,
      executedAt: timestamp,
    });
  }

  return NextResponse.json({ results });
}
