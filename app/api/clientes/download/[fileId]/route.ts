import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { ensureDatabaseConnection, sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  const user = await getRequestUser(request);
  if (!user) {
    const response = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(response.headers);
    return response;
  }

  const { fileId } = params;

  await ensureDatabaseConnection();

  const rows = await sql<{ file_name: string; file_mime: string; file_data: string; file_size: number }[]>`
    SELECT file_name, file_mime, file_data, file_size
    FROM client_files
    WHERE id = ${fileId} AND user_id = ${user.id}
    LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const { file_name, file_mime, file_data, file_size } = rows[0];
  const buffer = Buffer.from(file_data, "base64");

  const safeFileName = encodeURIComponent(file_name).replace(/'/g, "%27");

  return new Response(buffer, {
    headers: {
      "Content-Type": file_mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${safeFileName}`,
      "Content-Length": String(file_size || buffer.length),
      "Cache-Control": "private, no-cache",
    },
  });
}
