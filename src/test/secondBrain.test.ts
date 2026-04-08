import { describe, expect, it } from "vitest";
import {
  buildCapturePayload,
  buildSecondBrainGraphData,
  canCreateManualLink,
  computeWikiLinkSyncPlan,
  extractWikiLinkSlugs,
  filterSecondBrainNotes,
  parseTagsInput,
  rankConnectionSuggestions,
} from "@/lib/secondBrain";
import type { SecondBrainLink, SecondBrainNote } from "@/types";

function makeNote(partial: Partial<SecondBrainNote>): SecondBrainNote {
  return {
    id: partial.id || "note-id",
    user_id: partial.user_id || "user-1",
    project_id: partial.project_id ?? null,
    title: partial.title || "Note",
    slug: partial.slug || "note",
    content_md: partial.content_md || "",
    source_url: partial.source_url || null,
    tags: partial.tags || [],
    status: partial.status || "note",
    captured_at: partial.captured_at || "2026-03-03T12:00:00.000Z",
    created_at: partial.created_at || "2026-03-03T12:00:00.000Z",
    updated_at: partial.updated_at || "2026-03-03T12:00:00.000Z",
  };
}

function makeLink(partial: Partial<SecondBrainLink>): SecondBrainLink {
  return {
    id: partial.id || "link-id",
    user_id: partial.user_id || "user-1",
    source_note_id: partial.source_note_id || "a",
    target_note_id: partial.target_note_id || "b",
    link_type: partial.link_type || "manual",
    created_at: partial.created_at || "2026-03-03T12:00:00.000Z",
  };
}

describe("secondBrain utils", () => {
  it("extracts wikilinks, normalizes to slug and deduplicates", () => {
    const markdown = `
      Texto [[Minha Nota]]
      Outra [[Minha Nota]]
      Alias [[Plano Semanal|Plano]]
      Ignorar [[   ]]
    `;

    expect(extractWikiLinkSlugs(markdown)).toEqual(["minha-nota", "plano-semanal"]);
  });

  it("parses tags in lowercase without duplicates", () => {
    expect(parseTagsInput(" AI, pkm,AI,  foco ")).toEqual(["ai", "pkm", "foco"]);
  });

  it("ranks suggestions by shared tags then updated_at", () => {
    const current = makeNote({ id: "1", title: "Current", tags: ["pkm", "ai"], updated_at: "2026-03-03T10:00:00Z" });
    const notes = [
      current,
      makeNote({ id: "2", title: "A", tags: ["ai"], updated_at: "2026-03-03T11:00:00Z" }),
      makeNote({ id: "3", title: "B", tags: ["pkm", "ai"], updated_at: "2026-03-03T09:00:00Z" }),
      makeNote({ id: "4", title: "C", tags: ["finance"], updated_at: "2026-03-03T12:00:00Z" }),
      makeNote({ id: "5", title: "D", tags: ["pkm"], status: "archived", updated_at: "2026-03-03T13:00:00Z" }),
    ];
    const links = [makeLink({ source_note_id: "1", target_note_id: "2" })];

    const ranked = rankConnectionSuggestions(current, notes, links, 5);
    expect(ranked.map((item) => item.note.id)).toEqual(["3"]);
    expect(ranked[0].sharedTagsCount).toBe(2);
  });

  it("builds capture payload with inbox status, title and slug", () => {
    const payload = buildCapturePayload({
      content: "Minha Ideia\nMais contexto",
      sourceUrl: "https://example.com",
      tagsInput: "PKM, ideia",
      existingSlugs: ["minha-ideia"],
      capturedAt: new Date("2026-03-03T12:00:00.000Z"),
    });

    expect(payload.status).toBe("inbox");
    expect(payload.title).toBe("Minha Ideia");
    expect(payload.slug).toBe("minha-ideia-2");
    expect(payload.tags).toEqual(["pkm", "ideia"]);
    expect(payload.source_url).toBe("https://example.com");
  });

  it("computes wikilink sync create/delete sets", () => {
    const plan = computeWikiLinkSyncPlan(["b", "c"], ["c", "d"]);
    expect(plan).toEqual({ toCreate: ["d"], toDelete: ["b"] });
  });

  it("blocks manual self-link and duplicate links", () => {
    const links = [makeLink({ source_note_id: "a", target_note_id: "b" })];

    expect(canCreateManualLink("a", "a", links)).toEqual({ ok: false, reason: "self_link" });
    expect(canCreateManualLink("a", "b", links)).toEqual({ ok: false, reason: "duplicate" });
    expect(canCreateManualLink("a", "c", links)).toEqual({ ok: true });
  });

  it("builds graph from filtered notes and matching edges", () => {
    const notes = [
      makeNote({ id: "1", title: "Second Brain", tags: ["pkm"], status: "inbox" }),
      makeNote({ id: "2", title: "Kanban", tags: ["prod"], status: "note" }),
      makeNote({ id: "3", title: "Arquivada", tags: ["pkm"], status: "archived" }),
    ];
    const links = [
      makeLink({ id: "l1", source_note_id: "1", target_note_id: "2" }),
      makeLink({ id: "l2", source_note_id: "1", target_note_id: "3" }),
    ];

    const filtered = filterSecondBrainNotes(notes, "brain", "active", "pkm");
    const graph = buildSecondBrainGraphData(filtered, links);

    expect(graph.nodes.map((node) => node.id)).toEqual(["1"]);
    expect(graph.links).toEqual([]);
  });
});

