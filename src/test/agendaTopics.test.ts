import { describe, expect, it } from "vitest";
import { buildMeetingTopicsSummaryText, groupTopicsByStatus } from "@/lib/agendaTopics";
import type { MeetingTopic } from "@/hooks/useAgendaTopics";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";

function makeTopic(partial: Partial<MeetingTopic>): MeetingTopic {
  return {
    id: partial.id || "topic-id",
    user_id: partial.user_id || "user-1",
    meeting_event_id: partial.meeting_event_id || "event-1",
    meeting_series_key: partial.meeting_series_key || "series-1",
    meeting_start_at: partial.meeting_start_at || "2026-03-04T10:00:00",
    meeting_summary: partial.meeting_summary || "Reuniao semanal",
    project_id: partial.project_id || null,
    tags: partial.tags || [],
    title: partial.title || "Topico",
    detail: partial.detail || "",
    conclusion: partial.conclusion || "",
    status: partial.status || "pending",
    carried_from_topic_id: partial.carried_from_topic_id || null,
    created_at: partial.created_at || "2026-03-04T10:00:00",
    updated_at: partial.updated_at || "2026-03-04T10:00:00",
  };
}

const meeting: Pick<CalendarEvent, "summary" | "start" | "end" | "allDay"> = {
  summary: "Reuniao semanal",
  start: "2026-03-04T14:30:00",
  end: "2026-03-04T15:30:00",
  allDay: false,
};

describe("agendaTopics utils", () => {
  it("monta resumo vazio com seções sem topicos", () => {
    const text = buildMeetingTopicsSummaryText(meeting, []);

    expect(text).toContain("Reuniao: Reuniao semanal");
    expect(text).toContain("Pendentes:");
    expect(text).toContain("Em andamento:");
    expect(text).toContain("Resolvidos:");
    expect(text).toContain("- Nenhum");
  });

  it("agrupa topicos corretamente por status", () => {
    const grouped = groupTopicsByStatus([
      makeTopic({ id: "1", status: "resolved" }),
      makeTopic({ id: "2", status: "pending" }),
      makeTopic({ id: "3", status: "in_progress" }),
      makeTopic({ id: "4", status: "pending" }),
    ]);

    expect(grouped.pending.map((topic) => topic.id)).toEqual(["2", "4"]);
    expect(grouped.in_progress.map((topic) => topic.id)).toEqual(["3"]);
    expect(grouped.resolved.map((topic) => topic.id)).toEqual(["1"]);
  });

  it("inclui detalhe e conclusao no resumo", () => {
    const text = buildMeetingTopicsSummaryText(meeting, [
      makeTopic({
        id: "pending-topic",
        status: "pending",
        title: "Validar formularios",
        detail: "Ajustar links em idiomas diferentes",
      }),
      makeTopic({
        id: "resolved-topic",
        status: "resolved",
        title: "Corrigir form link not found",
        conclusion: "Fluxo ajustado e causa raiz tratada",
      }),
    ]);

    expect(text).toContain("Detalhe: Ajustar links em idiomas diferentes");
    expect(text).toContain("Conclusao: Fluxo ajustado e causa raiz tratada");
  });

  it("preserva ordem por created_at dentro de cada status", () => {
    const grouped = groupTopicsByStatus([
      makeTopic({
        id: "late",
        status: "pending",
        created_at: "2026-03-04T11:00:00",
      }),
      makeTopic({
        id: "early",
        status: "pending",
        created_at: "2026-03-04T10:00:00",
      }),
    ]);

    expect(grouped.pending.map((topic) => topic.id)).toEqual(["early", "late"]);
  });
});
