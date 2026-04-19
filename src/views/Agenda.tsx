import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  Clock,
  ExternalLink,
  Link2Off,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Check,
  X,
  Tags,
  AlertCircle,
} from "lucide-react";
import {
  addWeeks,
  differenceInMinutes,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import {
  AgendaPreferences,
  AgendaPriority,
  CalendarEvent,
  DEFAULT_AGENDA_PREFERENCES,
  useGoogleCalendar,
} from "@/hooks/useGoogleCalendar";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import {
  AGENDA_PRIORITIES as PRIORITIES,
  AGENDA_PRIORITY_ORDER as PRIORITY_ORDER,
  RESPONSE_STATUS_LABEL,
} from "@/config/priorities";
import type { Project } from "@/types";

function sanitizeDescription(value: string | null) {
  if (!value) return null;

  const clean = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > 0 ? clean : null;
}

function parseTagsInput(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

function statusMatchesFilter(event: CalendarEvent, filter: AgendaPreferences["statusFilter"]) {
  if (filter === "all") return true;
  if (filter === "accepted") return event.selfResponseStatus === "accepted";
  if (filter === "declined") return event.selfResponseStatus === "declined";
  return event.selfResponseStatus === "needsAction" || event.selfResponseStatus === "none" || event.selfResponseStatus === "tentative";
}

type EventMomentState = "past" | "live" | "upcoming";
type EventBucket = "pending" | "confirmed" | "live" | "past";

function getEventMomentState(start: Date, end: Date, now: Date): EventMomentState {
  if (isBefore(end, now)) return "past";
  if (isAfter(start, now)) return "upcoming";
  return "live";
}

function getEventBucket(event: CalendarEvent, now: Date): EventBucket {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const momentState = getEventMomentState(startDate, endDate, now);

  if (momentState === "past") return "past";
  if (momentState === "live") return "live";
  if (event.selfResponseStatus === "needsAction" || event.selfResponseStatus === "none" || event.selfResponseStatus === "tentative") {
    return "pending";
  }
  return "confirmed";
}

function getEventMomentLabel(event: CalendarEvent, now: Date) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const momentState = getEventMomentState(startDate, endDate, now);

  if (momentState === "past") {
    return {
      label: "Encerrada",
      className: "border-border bg-background text-muted-foreground",
    };
  }

  if (momentState === "live") {
    return {
      label: "Acontecendo agora",
      className: "border-primary/30 bg-primary/10 text-primary",
    };
  }

  const minutesUntilStart = differenceInMinutes(startDate, now);

  if (minutesUntilStart <= 60) {
    return {
      label: "Comeca em breve",
      className: "border-warning/40 bg-warning/10 text-warning",
    };
  }

  if (isToday(startDate)) {
    return {
      label: "Ainda hoje",
      className: "border-primary/20 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Próxima",
    className: "border-border bg-background text-muted-foreground",
  };
}

function getResponseBadge(event: CalendarEvent) {
  if (event.selfResponseStatus === "accepted") {
    return {
      label: "Aceita",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (event.selfResponseStatus === "declined") {
    return {
      label: "Recusada",
      className: "border-danger/40 bg-danger/10 text-danger",
    };
  }

  return {
    label: "Aguardando resposta",
    className: "border-warning/40 bg-warning/10 text-warning",
  };
}

function AgendaGroup({
  title,
  description,
  count,
  events,
  projects,
  respondingEventId,
  savingSeriesKey,
  onRespond,
  onSaveMetadata,
}: {
  title: string;
  description: string;
  count: number;
  events: CalendarEvent[];
  projects: Project[];
  respondingEventId: string | null;
  savingSeriesKey: string | null;
  onRespond: (eventId: string, status: "accepted" | "declined") => Promise<void>;
  onSaveMetadata: (
    seriesKey: string,
    priority: AgendaPriority,
    tags: string[],
    projectId: string | null,
    projectName: string | null,
  ) => Promise<void>;
}) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            projects={projects}
            respondingEventId={respondingEventId}
            savingSeriesKey={savingSeriesKey}
            onRespond={onRespond}
            onSaveMetadata={onSaveMetadata}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  projects,
  respondingEventId,
  savingSeriesKey,
  onRespond,
  onSaveMetadata,
}: {
  event: CalendarEvent;
  projects: Project[];
  respondingEventId: string | null;
  savingSeriesKey: string | null;
  onRespond: (eventId: string, status: "accepted" | "declined") => Promise<void>;
  onSaveMetadata: (
    seriesKey: string,
    priority: AgendaPriority,
    tags: string[],
    projectId: string | null,
    projectName: string | null,
  ) => Promise<void>;
}) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const now = new Date();
  const [priority, setPriority] = useState<AgendaPriority>(event.priority);
  const [tagsInput, setTagsInput] = useState(event.tags.join(", "));
  const [projectValue, setProjectValue] = useState(projectSelectValue(event.projectId));
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    setPriority(event.priority);
    setTagsInput(event.tags.join(", "));
    setProjectValue(projectSelectValue(event.projectId));
  }, [event.priority, event.tags, event.seriesKey, event.projectId]);

  const description = sanitizeDescription(event.description);
  const tags = event.tags;
  const isDeclined = event.selfResponseStatus === "declined";
  const isResponding = respondingEventId === event.id;
  const isSavingSeries = savingSeriesKey === event.seriesKey || savingDraft;
  const eventMoment = getEventMomentLabel(event, now);
  const responseBadge = getResponseBadge(event);
  const eventBucket = getEventBucket(event, now);
  const showPendingActions = event.canRespond && eventBucket === "pending";
  const showAcceptedState = event.selfResponseStatus === "accepted" && eventBucket !== "past";
  const showDeclinedState = event.selfResponseStatus === "declined";
  const showDeclineAction = event.canRespond && eventBucket !== "past" && event.selfResponseStatus === "accepted";

  const handleSaveMetadata = async () => {
    setSavingDraft(true);
    try {
      const projectId = projectIdFromSelectValue(projectValue);
      const projectName = projects.find((project) => project.id === projectId)?.name || null;
      await onSaveMetadata(event.seriesKey, priority, parseTagsInput(tagsInput), projectId, projectName);
      toast.success("Classificacao da reunião atualizada");
    } catch (err) {
      toast.error((err as Error).message || "Erro ao salvar metadados");
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        isDeclined ? "border-danger/40 opacity-90" : "border-border",
        eventBucket === "live" && "border-primary/40 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-2 text-center md:min-w-[58px]">
          <div>
            <p className="text-[11px] font-semibold uppercase text-primary">
              {format(startDate, "MMM", { locale: ptBR })}
            </p>
            <p className="text-xl font-bold leading-tight text-foreground">{format(startDate, "dd")}</p>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{event.summary}</p>
            <Badge className={cn("border", eventMoment.className)}>{eventMoment.label}</Badge>
            <Badge className={cn("border", PRIORITIES.find((item) => item.value === event.priority)?.badgeClass)}>
              {PRIORITIES.find((item) => item.value === event.priority)?.label}
            </Badge>
            <Badge className={cn("border", responseBadge.className)}>{responseBadge.label}</Badge>
            <Badge variant="secondary">{event.projectName || "Conhecimento geral"}</Badge>
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                <Tags className="h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.allDay
                ? "Dia inteiro"
                : `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>

          {description && <p className="text-xs text-muted-foreground">{description}</p>}

          {showAcceptedState && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Presenca confirmada. Esta reunião já foi aceita por você.
            </div>
          )}

          {showDeclinedState && eventBucket !== "past" && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              Convite recusado. A reunião continua visível para contexto, mas não esta mais pendente.
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-[160px_190px_1fr_auto]">
            <Select value={priority} onValueChange={(value) => setPriority(value as AgendaPriority)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectValue} onValueChange={setProjectValue}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_PROJECT_VALUE}>Conhecimento geral</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={tagsInput}
              onChange={(eventInput) => setTagsInput(eventInput.target.value)}
              className="h-9"
              placeholder="Tags separadas por virgula"
            />

            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={isSavingSeries}
              onClick={() => {
                void handleSaveMetadata();
              }}
            >
              {isSavingSeries ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Abrir no Google
            <ExternalLink className="h-3 w-3" />
          </a>

          <Button asChild size="sm" variant="outline">
            <Link href={`/atas?meeting=${encodeURIComponent(event.id)}`}>
              Ver atas
            </Link>
          </Button>

          {showPendingActions && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                disabled={isResponding}
                onClick={() => {
                  void onRespond(event.id, "accepted");
                }}
              >
                <Check className="mr-1 h-3 w-3" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant={event.selfResponseStatus === "declined" ? "destructive" : "outline"}
                disabled={isResponding}
                onClick={() => {
                  void onRespond(event.id, "declined");
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Recusar
              </Button>
            </div>
          )}

          {showDeclineAction && (
            <Button
              size="sm"
              variant="outline"
              disabled={isResponding}
              onClick={() => {
                void onRespond(event.id, "declined");
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Recusar agora
            </Button>
          )}

          {!event.canRespond && (
            <span className="text-xs text-muted-foreground">
              {event.isOrganizer ? "Organizada por você" : RESPONSE_STATUS_LABEL[event.selfResponseStatus]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const {
    events,
    loading,
    connected,
    connectionReady,
    error,
    insufficientScope,
    disconnect,
    respondToInvite,
    createMeeting,
    saveEventMetadata,
    loadPreferences,
    savePreferences,
    fetchEvents,
  } = useGoogleCalendar();

  const handleConnectGoogle = async () => {
    try {
      window.location.href = "/api/google-calendar/connect";
    } catch (err) {
      console.error("Google Calendar connect error", err);
      toast.error(err instanceof Error ? err.message : "Erro ao conectar Google Calendar");
    }
  };

  const [weekOffset, setWeekOffset] = useState(0);
  const [preferences, setPreferences] = useState<AgendaPreferences>(DEFAULT_AGENDA_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);

  const [respondingEventId, setRespondingEventId] = useState<string | null>(null);
  const [savingSeriesKey, setSavingSeriesKey] = useState<string | null>(null);
  const activePreset = useMemo(() => {
    const preset = searchParams?.get("preset");
    if (preset === "today" || preset === "pending-response") {
      return preset;
    }
    return null;
  }, [searchParams]);

  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDate, setMeetingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meetingStartTime, setMeetingStartTime] = useState("09:00");
  const [meetingEndTime, setMeetingEndTime] = useState("10:00");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [createMeetLink, setCreateMeetLink] = useState(true);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const googleStatus = searchParams.get("google");
    const googleMessage = searchParams.get("message");

    if (!googleStatus) {
      return;
    }

    if (googleStatus === "connected") {
      toast.success("Google Calendar conectado");
    } else if (googleStatus === "denied") {
      toast.error("Conexão com Google cancelada");
    } else if (googleStatus === "error") {
      toast.error(googleMessage || "Falha ao conectar Google Calendar");
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("google");
    nextUrl.searchParams.delete("message");
    const normalizedUrl = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    window.history.replaceState({}, "", normalizedUrl);
  }, [searchParams]);
  const [projects, setProjects] = useState<Project[]>([]);

  const weekRange = useMemo(() => {
    const currentDate = addWeeks(new Date(), weekOffset);
    const weekStartDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEndDate = endOfWeek(currentDate, { weekStartsOn: 1 });

    return {
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      weekStartIso: weekStartDate.toISOString(),
      weekEndIso: weekEndDate.toISOString(),
    };
  }, [weekOffset]);

  const weekStart = weekRange.weekStart;
  const weekEnd = weekRange.weekEnd;

  useEffect(() => {
    if (!user) return;

    const loadProjects = async () => {
      const { data, error: projectError } = await db
        .from("projects")
        .select("*")
        .order("name");

      if (projectError) {
        toast.error("Não foi possível carregar empresas para associacao na agenda");
        return;
      }

      setProjects((data || []) as unknown as Project[]);
    };

    void loadProjects();
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const loaded = await loadPreferences();
      if (!cancelled) {
        setPreferences(loaded);
        setPreferencesReady(true);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadPreferences]);

  useEffect(() => {
    void fetchEvents(weekRange.weekStartIso, weekRange.weekEndIso);
  }, [fetchEvents, weekRange.weekStartIso, weekRange.weekEndIso]);

  const persistPreferences = (next: AgendaPreferences) => {
    setPreferences(next);
    void savePreferences(next).catch(() => {
      toast.error("Não foi possível salvar preferencia de agenda");
    });
  };

  const priorityOptions = PRIORITIES.map((item) => item.value);

  const availableTags = useMemo(() => {
    return [...new Set(events.flatMap((event) => event.tags))].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const effectivePreferences = useMemo(() => {
    if (activePreset === "pending-response") {
      return {
        ...preferences,
        statusFilter: "pending" as AgendaPreferences["statusFilter"],
        showDeclined: false,
      };
    }

    return preferences;
  }, [activePreset, preferences]);

  useEffect(() => {
    if (activePreset === "today") {
      setWeekOffset(0);
    }
  }, [activePreset]);

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (!effectivePreferences.showDeclined && event.selfResponseStatus === "declined") return false;
      if (!statusMatchesFilter(event, effectivePreferences.statusFilter)) return false;

      if (effectivePreferences.priorityFilter.length > 0 && !effectivePreferences.priorityFilter.includes(event.priority)) {
        return false;
      }

      if (effectivePreferences.tagFilter.length > 0) {
        const hasTag = effectivePreferences.tagFilter.some((tag) => event.tags.includes(tag));
        if (!hasTag) return false;
      }

      return true;
    });

    const byTime = (a: CalendarEvent, b: CalendarEvent) => parseISO(a.start).getTime() - parseISO(b.start).getTime();

    if (effectivePreferences.sortMode === "time_only") {
      return filtered.sort(byTime);
    }

    return filtered.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return byTime(a, b);
    });
  }, [effectivePreferences, events]);

  const agendaSummary = useMemo(() => {
    const now = new Date();

    return filteredEvents.reduce(
      (acc, event) => {
        const bucket = getEventBucket(event, now);
        acc.total += 1;
        acc[bucket] += 1;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        confirmed: 0,
        live: 0,
        past: 0,
      },
    );
  }, [filteredEvents]);

  const days = useMemo(() => {
    const result: {
      date: Date;
      events: CalendarEvent[];
      groupedEvents: Record<EventBucket, CalendarEvent[]>;
    }[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayEvents = filteredEvents.filter((event) => isSameDay(parseISO(event.start), day));

      result.push({
        date: day,
        events: dayEvents,
        groupedEvents: {
          pending: dayEvents.filter((event) => getEventBucket(event, now) === "pending"),
          live: dayEvents.filter((event) => getEventBucket(event, now) === "live"),
          confirmed: dayEvents.filter((event) => getEventBucket(event, now) === "confirmed"),
          past: dayEvents.filter((event) => getEventBucket(event, now) === "past"),
        },
      });
    }

    return result;
  }, [filteredEvents, weekStart]);

  const visibleDays = useMemo(() => {
    if (activePreset === "today") {
      return days.filter((day) => isToday(day.date));
    }

    return days;
  }, [activePreset, days]);

  const handleWeekChange = (direction: -1 | 1) => {
    setWeekOffset((current) => current + direction);
  };

  const togglePriorityFilter = (priority: AgendaPriority) => {
    const current = preferences.priorityFilter;
    const next = current.includes(priority)
      ? current.filter((item) => item !== priority)
      : [...current, priority];

    persistPreferences({
      ...preferences,
      priorityFilter: next,
    });
  };

  const toggleTagFilter = (tag: string) => {
    const current = preferences.tagFilter;
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];

    persistPreferences({
      ...preferences,
      tagFilter: next,
    });
  };

  const handleRespond = async (eventId: string, status: "accepted" | "declined") => {
    setRespondingEventId(eventId);
    try {
      await respondToInvite(eventId, status);
      toast.success(status === "accepted" ? "Reunião aceita" : "Reunião recusada");

      if (status === "accepted" && user) {
        const event = events.find((e) => e.id === eventId);
        if (event) {
          const { data: existing } = await (db as any)
            .from("agenda_meeting_topics")
            .select("id")
            .eq("user_id", user.id)
            .eq("meeting_event_id", eventId)
            .maybeSingle();

          if (!existing) {
            await (db as any).from("agenda_meeting_topics").insert({
              user_id: user.id,
              meeting_event_id: event.id,
              meeting_series_key: event.seriesKey,
              meeting_start_at: event.start,
              meeting_summary: event.summary,
              title: "Pauta da reunião",
              status: "pending",
              checklist_json: [],
            });
            toast.info("Item criado em Atas", {
              description: event.summary,
              action: {
                label: "Ver atas",
                onClick: () => window.open(`/atas?meeting=${encodeURIComponent(eventId)}`, "_self"),
              },
            });
          }
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Falha ao responder convite");
    } finally {
      setRespondingEventId(null);
    }
  };

  const handleSaveMetadata = async (
    seriesKey: string,
    priority: AgendaPriority,
    tags: string[],
    projectId: string | null,
    projectName: string | null,
  ) => {
    setSavingSeriesKey(seriesKey);
    try {
      await saveEventMetadata(seriesKey, priority, tags, projectId, projectName);
    } finally {
      setSavingSeriesKey(null);
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingSummary.trim()) {
      toast.error("Título da reunião e obrigatório");
      return;
    }

    const startIso = new Date(`${meetingDate}T${meetingStartTime}:00`).toISOString();
    const endIso = new Date(`${meetingDate}T${meetingEndTime}:00`).toISOString();

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      toast.error("Horário final precisa ser maior que o inicial");
      return;
    }

    setCreatingMeeting(true);

    try {
      await createMeeting({
        summary: meetingSummary.trim(),
        description: meetingDescription.trim() || undefined,
        location: meetingLocation.trim() || undefined,
        start: startIso,
        end: endIso,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendees: parseTagsInput(meetingAttendees),
        createMeet: createMeetLink,
      });

      toast.success("Reunião criada no Google Calendar");
      setMeetingDialogOpen(false);
      setMeetingSummary("");
      setMeetingDescription("");
      setMeetingLocation("");
      setMeetingAttendees("");
      setCreateMeetLink(true);
    } catch (err) {
      toast.error((err as Error).message || "Erro ao criar reunião");
    } finally {
      setCreatingMeeting(false);
    }
  };

  if (!connected && connectionReady && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">Seus compromissos e eventos</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-primary" />
          <p className="mb-2 text-lg font-medium text-foreground">Conecte seu Google Calendar</p>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            Veja eventos, responda convites e crie reuniões direto no WorkOS.
          </p>
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}
          <Button onClick={handleConnectGoogle} className="gap-2">
            <Calendar className="h-4 w-4" />
            Conectar Google Calendar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1">
                <Plus className="h-4 w-4" />
                Nova reunião
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Criar reunião</DialogTitle>
                <DialogDescription>Crie reunião no Google Calendar com convidados e Google Meet opcional.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={meetingSummary} onChange={(event) => setMeetingSummary(event.target.value)} placeholder="Assunto da reunião" />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Inicio</Label>
                      <Input type="time" value={meetingStartTime} onChange={(event) => setMeetingStartTime(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="time" value={meetingEndTime} onChange={(event) => setMeetingEndTime(event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} placeholder="Opcional" />
                </div>

                <div className="space-y-2">
                  <Label>Convidados</Label>
                  <Input
                    value={meetingAttendees}
                    onChange={(event) => setMeetingAttendees(event.target.value)}
                    placeholder="email1@dominio.com, email2@dominio.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={meetingDescription}
                    onChange={(event) => setMeetingDescription(event.target.value)}
                    placeholder="Pauta da reunião"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Criar link Google Meet</p>
                    <p className="text-xs text-muted-foreground">Ative para gerar videoconferência automaticamente</p>
                  </div>
                  <Switch checked={createMeetLink} onCheckedChange={setCreateMeetLink} />
                </div>

                <Button onClick={() => void handleCreateMeeting()} className="w-full" disabled={creatingMeeting}>
                  {creatingMeeting ? "Criando..." : "Criar reunião"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon" onClick={() => handleWeekChange(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWeekOffset(0);
            }}
            className="text-xs"
          >
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleWeekChange(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void fetchEvents(weekRange.weekStartIso, weekRange.weekEndIso)}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={disconnect} className="gap-1 text-xs text-muted-foreground">
            <Link2Off className="h-3 w-3" />
            Desconectar
          </Button>
        </div>
      </div>

      {activePreset ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Preset ativo</p>
              <p className="mt-1 text-sm text-foreground">
                {activePreset === "today"
                  ? "Mostrando a agenda do dia atual dentro da semana corrente."
                  : "Mostrando apenas reuniões pendentes de resposta."}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/agenda">Limpar preset</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {(insufficientScope || error) && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error || "Permissão insuficiente no Google Calendar para escrita."}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleConnectGoogle}>
            Reconectar Google
          </Button>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pendentes</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.pending}</p>
            <p className="text-xs text-muted-foreground">Convites aguardando sua resposta.</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Em andamento</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.live}</p>
            <p className="text-xs text-muted-foreground">Reuniões acontecendo agora.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confirmadas</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.confirmed}</p>
            <p className="text-xs text-muted-foreground">Próximas reuniões já aceitas.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Encerradas</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.past}</p>
            <p className="text-xs text-muted-foreground">Eventos que já aconteceram.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <Select
              value={activePreset === "pending-response" ? "pending" : preferences.statusFilter}
              onValueChange={(value) =>
                persistPreferences({
                  ...preferences,
                  statusFilter: value as AgendaPreferences["statusFilter"],
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="accepted">Aceitos</SelectItem>
                <SelectItem value="declined">Recusados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <Select
              value={preferences.sortMode}
              onValueChange={(value) =>
                persistPreferences({
                  ...preferences,
                  sortMode: value as AgendaPreferences["sortMode"],
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Ordenacao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority_then_time">Prioridade e horário</SelectItem>
                <SelectItem value="time_only">Somente horário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
            <Switch
              checked={preferences.showDeclined}
              onCheckedChange={(checked) =>
                persistPreferences({
                  ...preferences,
                  showDeclined: checked,
                })
              }
            />
            <span className="text-xs text-muted-foreground">Mostrar recusados</span>
          </div>

          <Button variant="outline" size="sm" onClick={() => persistPreferences(DEFAULT_AGENDA_PREFERENCES)}>
            Limpar filtros
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Prioridade</p>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.map((priority) => {
              const priorityItem = PRIORITIES.find((item) => item.value === priority);
              const active = preferences.priorityFilter.includes(priority);
              return (
                <button
                  key={priority}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? priorityItem?.badgeClass
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => togglePriorityFilter(priority)}
                  type="button"
                >
                  {priorityItem?.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Tags</p>
          {availableTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada nesta semana.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const active = preferences.tagFilter.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => toggleTagFilter(tag)}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!preferencesReady && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Carregando preferencias da agenda...
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {visibleDays.map(({ date, events: dayEvents, groupedEvents }) => (
            <div key={date.toISOString()}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isToday(date) ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                {isToday(date) && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                    Hoje
                  </span>
                )}
              </div>

              {dayEvents.length > 0 ? (
                <div className="space-y-4">
                  <AgendaGroup
                    title="Pendentes de resposta"
                    description="Reuniões que ainda precisam da sua confirmação."
                    count={groupedEvents.pending.length}
                    events={groupedEvents.pending}
                    projects={projects}
                    respondingEventId={respondingEventId}
                    savingSeriesKey={savingSeriesKey}
                    onRespond={handleRespond}
                    onSaveMetadata={handleSaveMetadata}
                  />
                  <AgendaGroup
                    title="Acontecendo agora"
                    description="Compromissos ativos neste momento."
                    count={groupedEvents.live.length}
                    events={groupedEvents.live}
                    projects={projects}
                    respondingEventId={respondingEventId}
                    savingSeriesKey={savingSeriesKey}
                    onRespond={handleRespond}
                    onSaveMetadata={handleSaveMetadata}
                  />
                  <AgendaGroup
                    title="Próximas já aceitas"
                    description="Reuniões futuras que já estão confirmadas."
                    count={groupedEvents.confirmed.length}
                    events={groupedEvents.confirmed}
                    projects={projects}
                    respondingEventId={respondingEventId}
                    savingSeriesKey={savingSeriesKey}
                    onRespond={handleRespond}
                    onSaveMetadata={handleSaveMetadata}
                  />
                  <AgendaGroup
                    title="Já encerradas"
                    description="Histórico do que já aconteceu neste dia."
                    count={groupedEvents.past.length}
                    events={groupedEvents.past}
                    projects={projects}
                    respondingEventId={respondingEventId}
                    savingSeriesKey={savingSeriesKey}
                    onRespond={handleRespond}
                    onSaveMetadata={handleSaveMetadata}
                  />
                </div>
              ) : (
                <p className="pl-1 text-xs italic text-muted-foreground/60">Nenhum evento</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




