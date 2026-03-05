import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import type { Tables } from "@/integrations/supabase/types";

export type MeetingTopicStatus = "pending" | "in_progress" | "resolved";
type MeetingTopicRow = Tables<"agenda_meeting_topics">;
export type MeetingTopic = Omit<MeetingTopicRow, "status"> & {
  status: MeetingTopicStatus;
};

export const MEETING_TOPIC_STATUS_LABEL: Record<MeetingTopicStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  resolved: "Resolvido",
};

export type GroupedMeetingTopics = Record<MeetingTopicStatus, MeetingTopic[]>;

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function sortTopicsByCreatedAt(topics: MeetingTopic[]) {
  return [...topics].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function formatMeetingWhen(meeting: Pick<CalendarEvent, "start" | "end" | "allDay">) {
  const start = parseISO(meeting.start);
  const end = parseISO(meeting.end);

  if (Number.isNaN(start.getTime())) {
    return "Data invalida";
  }

  if (meeting.allDay) {
    return format(start, "dd/MM/yyyy", { locale: ptBR });
  }

  if (Number.isNaN(end.getTime())) {
    return format(start, "dd/MM/yyyy HH:mm", { locale: ptBR });
  }

  return `${format(start, "dd/MM/yyyy HH:mm", { locale: ptBR })} - ${format(end, "HH:mm", { locale: ptBR })}`;
}

function renderSection(
  title: string,
  topics: MeetingTopic[],
  includeConclusion: boolean,
) {
  const lines: string[] = [`${title}:`];

  if (topics.length === 0) {
    lines.push("- Nenhum");
    return lines.join("\n");
  }

  for (const topic of topics) {
    lines.push(`- ${topic.title}`);

    const detail = normalizeText(topic.detail);
    if (detail) {
      lines.push(`  Detalhe: ${detail}`);
    }

    if (includeConclusion) {
      const conclusion = normalizeText(topic.conclusion);
      if (conclusion) {
        lines.push(`  Conclusao: ${conclusion}`);
      }
    }
  }

  return lines.join("\n");
}

export function groupTopicsByStatus(topics: MeetingTopic[]): GroupedMeetingTopics {
  const grouped: GroupedMeetingTopics = {
    pending: [],
    in_progress: [],
    resolved: [],
  };

  for (const topic of topics) {
    grouped[topic.status].push(topic);
  }

  return {
    pending: sortTopicsByCreatedAt(grouped.pending),
    in_progress: sortTopicsByCreatedAt(grouped.in_progress),
    resolved: sortTopicsByCreatedAt(grouped.resolved),
  };
}

export function buildMeetingTopicsSummaryText(
  meeting: Pick<CalendarEvent, "summary" | "start" | "end" | "allDay">,
  topics: MeetingTopic[],
) {
  const grouped = groupTopicsByStatus(topics);

  const sections = [
    renderSection("Pendentes", grouped.pending, false),
    renderSection("Em andamento", grouped.in_progress, false),
    renderSection("Resolvidos", grouped.resolved, true),
  ];

  return [
    `Reuniao: ${meeting.summary}`,
    `Quando: ${formatMeetingWhen(meeting)}`,
    "",
    sections[0],
    "",
    sections[1],
    "",
    sections[2],
  ].join("\n");
}
