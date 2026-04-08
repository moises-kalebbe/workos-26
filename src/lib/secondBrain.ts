import { getUniqueSlug, slugify } from "@/lib/markdown";
import type {
  SecondBrainGraphEdge,
  SecondBrainGraphNode,
  SecondBrainLink,
  SecondBrainNote,
  SecondBrainStatus,
} from "@/types";

export type SecondBrainStatusFilter = "active" | "all" | SecondBrainStatus;

type CapturePayloadInput = {
  content: string;
  sourceUrl: string;
  tagsInput: string;
  existingSlugs: string[];
  capturedAt?: Date;
};

type Suggestion = {
  note: SecondBrainNote;
  sharedTagsCount: number;
};

function toComparableDate(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function parseTagsInput(input: string): string[] {
  const unique = new Set(
    input
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );

  return Array.from(unique);
}

export function buildCaptureTitle(content: string, capturedAt = new Date()): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    const cleaned = firstLine.replace(/^#+\s*/, "").trim();
    return (cleaned || firstLine).slice(0, 120);
  }

  const stamp = capturedAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Nota ${stamp}`;
}

export function buildCapturePayload({
  content,
  sourceUrl,
  tagsInput,
  existingSlugs,
  capturedAt = new Date(),
}: CapturePayloadInput) {
  const title = buildCaptureTitle(content, capturedAt);
  const slug = getUniqueSlug(title, existingSlugs);

  return {
    title,
    slug,
    content_md: content.trim(),
    source_url: sourceUrl.trim() || null,
    tags: parseTagsInput(tagsInput),
    status: "inbox" as const,
    captured_at: capturedAt.toISOString(),
  };
}

export function extractWikiLinkSlugs(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^[\]\r\n]+?)\]\]/g);
  const unique = new Set<string>();

  for (const match of matches) {
    const rawValue = (match[1] || "").split("|")[0]?.trim();
    if (!rawValue) continue;

    const slug = slugify(rawValue);
    if (!slug) continue;

    unique.add(slug);
  }

  return Array.from(unique);
}

export function computeWikiLinkSyncPlan(existingTargetIds: string[], desiredTargetIds: string[]) {
  const existing = new Set(existingTargetIds);
  const desired = new Set(desiredTargetIds);

  const toCreate = Array.from(desired).filter((targetId) => !existing.has(targetId));
  const toDelete = Array.from(existing).filter((targetId) => !desired.has(targetId));

  return { toCreate, toDelete };
}

export function canCreateManualLink(
  sourceNoteId: string,
  targetNoteId: string,
  links: SecondBrainLink[],
) {
  if (!sourceNoteId || !targetNoteId) {
    return { ok: false, reason: "invalid" as const };
  }

  if (sourceNoteId === targetNoteId) {
    return { ok: false, reason: "self_link" as const };
  }

  const alreadyLinked = links.some(
    (link) =>
      (link.source_note_id === sourceNoteId && link.target_note_id === targetNoteId) ||
      (link.source_note_id === targetNoteId && link.target_note_id === sourceNoteId),
  );

  if (alreadyLinked) {
    return { ok: false, reason: "duplicate" as const };
  }

  return { ok: true as const };
}

export function rankConnectionSuggestions(
  currentNote: SecondBrainNote | null,
  notes: SecondBrainNote[],
  links: SecondBrainLink[],
  limit = 5,
): Suggestion[] {
  if (!currentNote) return [];

  const currentTags = new Set(currentNote.tags || []);
  if (currentTags.size === 0) return [];

  const connectedIds = new Set<string>();
  links.forEach((link) => {
    if (link.source_note_id === currentNote.id) {
      connectedIds.add(link.target_note_id);
    } else if (link.target_note_id === currentNote.id) {
      connectedIds.add(link.source_note_id);
    }
  });

  return notes
    .filter((note) => note.id !== currentNote.id)
    .filter((note) => note.status !== "archived")
    .filter((note) => !connectedIds.has(note.id))
    .map((note) => {
      const sharedTagsCount = note.tags.filter((tag) => currentTags.has(tag)).length;
      return { note, sharedTagsCount };
    })
    .filter((item) => item.sharedTagsCount > 0)
    .sort((a, b) => {
      if (b.sharedTagsCount !== a.sharedTagsCount) {
        return b.sharedTagsCount - a.sharedTagsCount;
      }

      return toComparableDate(b.note.updated_at) - toComparableDate(a.note.updated_at);
    })
    .slice(0, limit);
}

export function filterSecondBrainNotes(
  notes: SecondBrainNote[],
  search: string,
  statusFilter: SecondBrainStatusFilter,
  tagFilterInput: string,
): SecondBrainNote[] {
  const term = search.trim().toLowerCase();
  const requiredTags = parseTagsInput(tagFilterInput);

  return notes
    .filter((note) => {
      if (statusFilter === "active") {
        return note.status !== "archived";
      }
      if (statusFilter === "all") {
        return true;
      }
      return note.status === statusFilter;
    })
    .filter((note) => {
      if (!term) return true;
      const haystack = `${note.title}\n${note.content_md}\n${note.tags.join(" ")}`.toLowerCase();
      return haystack.includes(term);
    })
    .filter((note) => {
      if (requiredTags.length === 0) return true;
      return requiredTags.every((tag) => note.tags.includes(tag));
    })
    .sort((a, b) => toComparableDate(b.updated_at) - toComparableDate(a.updated_at));
}

export function buildSecondBrainGraphData(
  notes: SecondBrainNote[],
  links: SecondBrainLink[],
): { nodes: SecondBrainGraphNode[]; links: SecondBrainGraphEdge[] } {
  const nodes: SecondBrainGraphNode[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    status: note.status,
    tags: note.tags,
  }));

  const visibleIds = new Set(nodes.map((node) => node.id));
  const graphLinks: SecondBrainGraphEdge[] = links
    .filter((link) => visibleIds.has(link.source_note_id) && visibleIds.has(link.target_note_id))
    .map((link) => ({
      id: link.id,
      source: link.source_note_id,
      target: link.target_note_id,
      link_type: link.link_type,
    }));

  return { nodes, links: graphLinks };
}

