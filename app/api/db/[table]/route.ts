import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { executeLocalDbQuery, LOCAL_DB_TABLES, type LocalDbPayload } from "@/lib/localDbGateway";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { table: string } }) {
  try {
    const table = params.table;
    if (!LOCAL_DB_TABLES.has(table)) {
      return NextResponse.json({ error: "Table not allowed" }, { status: 404 });
    }

    const user = await getRequestUser(request);
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      appendClerkResetHeaders(response.headers);
      return response;
    }

    const body = (await request.json().catch(() => ({}))) as LocalDbPayload;
    const result = await executeLocalDbQuery(table, user.id, body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
