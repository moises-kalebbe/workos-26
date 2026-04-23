import { NextResponse } from "next/server";
import { ensureDatabaseConnection, sql } from "@/lib/db";

export const runtime = "nodejs";

const CLIENT_ID = process.env.CLICKUP_CLIENT_ID!;
const CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect("/settings?tab=integracoes&clickup_error=missing_params");
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect("/settings?tab=integracoes&clickup_error=not_configured");
  }

  try {
    const tokenRes = await fetch("https://api.clickup.com/api/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error ?? "token_exchange_failed";
      return NextResponse.redirect(
        `/settings?tab=integracoes&clickup_error=${encodeURIComponent(errMsg)}`,
      );
    }

    await ensureDatabaseConnection();
    await sql`
      UPDATE profiles
      SET clickup_token = ${tokenData.access_token}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.redirect("/settings?tab=integracoes&clickup_connected=1");
  } catch (err) {
    console.error("[clickup/callback] error:", err);
    return NextResponse.redirect("/settings?tab=integracoes&clickup_error=server_error");
  }
}
