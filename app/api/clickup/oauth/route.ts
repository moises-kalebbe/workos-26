import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";

export const runtime = "nodejs";

const CLIENT_ID = process.env.CLICKUP_CLIENT_ID!;
const REDIRECT_URI = process.env.CLICKUP_REDIRECT_URI ?? "https://workos.moiseskalebbe.cloud/api/clickup/callback";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    const res = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(res.headers);
    return res;
  }

  if (!CLIENT_ID) {
    return NextResponse.json({ error: "CLICKUP_CLIENT_ID não configurado" }, { status: 500 });
  }

  const url = new URL("https://app.clickup.com/api");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", user.id);

  return NextResponse.redirect(url.toString());
}
