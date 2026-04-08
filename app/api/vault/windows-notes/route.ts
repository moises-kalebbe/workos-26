import { NextResponse } from "next/server";
import { appendClerkResetHeaders, getRequestUser } from "@/lib/auth";
import { createServerDbClient } from "@/lib/serverDbClient";
import { buildCapturePayload, parseTagsInput } from "@/lib/secondBrain";

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
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const sourceLabel = typeof body.sourceLabel === "string" && body.sourceLabel.trim() ? body.sourceLabel.trim() : "windows-notes-import";
  const tagsInput = typeof body.tagsInput === "string" ? body.tagsInput : "";

  if (notes.length === 0) {
    return NextResponse.json({ error: "Nenhuma nota para importar." }, { status: 400 });
  }

  const existingNotes = await db.from("second_brain_notes").select("slug").eq("user_id", user.id);
  const existingSlugs = (existingNotes.data || []).map((note: any) => note.slug);

  const rows = notes
    .map((item: any) => String(item?.content || "").trim())
    .filter((content) => content.length > 0)
    .map((content) => {
      const payload = buildCapturePayload({
        content,
        sourceUrl: "",
        tagsInput,
        existingSlugs,
      });
      existingSlugs.push(payload.slug);

      return {
        user_id: user.id,
        project_id: projectId,
        title: payload.title,
        slug: payload.slug,
        content_md: payload.content_md,
        source_url: null,
        source_type: "windows-notes-import",
        source_metadata: {
          sourceLabel,
          importedAt: new Date().toISOString(),
        },
        tags: [...new Set(["windows-import", ...parseTagsInput(tagsInput)])],
        status: "inbox",
        captured_at: payload.captured_at,
      };
    });

  const insertRes = await db.from("second_brain_notes").insert(rows).select("id");
  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  await db.from("vault_sync_runs").insert({
    user_id: user.id,
    project_id: projectId,
    run_type: "windows_notes_import",
    status: "success",
    summary: `${rows.length} nota(s) importada(s) para o Second Brain.`,
    details: { sourceLabel },
  });

  return NextResponse.json({ imported: rows.length, ids: insertRes.data || [] });
}
