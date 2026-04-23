import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { ensureDatabaseConnection, sql } from "@/lib/db";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    const response = NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    appendClerkResetHeaders(response.headers);
    return response;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { client_id, file_name, file_mime, file_size, file_data, service_date, service_type, description } = body as {
    client_id?: string;
    file_name?: string;
    file_mime?: string;
    file_size?: number;
    file_data?: string;
    service_date?: string;
    service_type?: string;
    description?: string;
  };

  if (!client_id || !file_name || !file_mime || !file_data || !service_date || !service_type) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  if (typeof file_size === "number" && file_size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 400 });
  }

  const base64Size = Math.ceil((file_data.length * 3) / 4);
  if (base64Size > MAX_FILE_SIZE * 1.4) {
    return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 400 });
  }

  await ensureDatabaseConnection();

  const owned = await sql<{ id: string }[]>`
    SELECT id FROM clients WHERE id = ${client_id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!owned[0]) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const result = await sql<{ id: string }[]>`
    INSERT INTO client_files
      (user_id, client_id, file_name, file_mime, file_size, file_data, service_date, service_type, description)
    VALUES
      (${user.id}, ${client_id}, ${file_name}, ${file_mime}, ${file_size ?? 0},
       ${file_data}, ${service_date}, ${service_type}, ${description ?? null})
    RETURNING id
  `;

  return NextResponse.json({ data: { id: result[0].id } });
}
