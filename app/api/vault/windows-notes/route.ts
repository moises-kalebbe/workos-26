import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/requestUser";
import { buildCapturePayload, parseTagsInput } from "@/lib/secondBrain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient() as any;
  const user = await getRequestUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const sourceLabel = typeof body.sourceLabel === "string" && body.sourceLabel.trim() ? body.sourceLabel.trim() : "windows-notes-import";
  const tagsInput = typeof body.tagsInput === "string" ? body.tagsInput : "";

  if (notes.length === 0) {
    return NextResponse.json({ error: "Nenhuma nota para importar." }, { status: 400 });
  }

  const existingNotes = await supabase.from("second_brain_notes").select("slug").eq("user_id", user.id);
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

  const insertRes = await supabase.from("second_brain_notes").insert(rows).select("id");
  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  await supabase.from("vault_sync_runs").insert({
    user_id: user.id,
    project_id: projectId,
    run_type: "windows_notes_import",
    status: "success",
    summary: `${rows.length} nota(s) importada(s) para o Second Brain.`,
    details: { sourceLabel },
  });

  return NextResponse.json({ imported: rows.length, ids: insertRes.data || [] });
}
