import { useEffect, useMemo, useState } from "react";
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

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];
const DEV_AUTH_USER_ID = process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

type ClerkExternalAccount = {
  provider?: string;
  approvedScopes?: string[];
  verification?: {
    externalVerificationRedirectURL?: URL | { href?: string } | string | null;
  } | null;
  reauthorize?: (params: {
    additionalScopes?: string[];
    redirectUrl?: string;
  }) => Promise<ClerkExternalAccount>;
};

type ClerkUserWithExternalAccounts = {
  externalAccounts?: ClerkExternalAccount[];
  createExternalAccount?: (params: {
    strategy: string;
    redirectUrl?: string;
    additionalScopes?: string[];
  }) => Promise<ClerkExternalAccount>;
};

function getExternalRedirectUrl(account: ClerkExternalAccount | null | undefined) {
  const redirect = account?.verification?.externalVerificationRedirectURL;
  if (!redirect) return null;
  if (typeof redirect === "string") return redirect;
  if ("href" in redirect && typeof redirect.href === "string") return redirect.href;
  if (redirect instanceof URL) return redirect.href;
  return null;
}

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
    label: "Proxima",
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
      toast.success("Classificacao da reuniao atualizada");
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
              Presenca confirmada. Esta reuniao ja foi aceita por voce.
            </div>
          )}

          {showDeclinedState && eventBucket !== "past" && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              Convite recusado. A reuniao continua visivel para contexto, mas nao esta mais pendente.
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
              {event.isOrganizer ? "Organizada por voce" : RESPONSE_STATUS_LABEL[event.selfResponseStatus]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const { user, getToken } = useAuth();

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
    storeGoogleToken,
    fetchEvents,
  } = useGoogleCalendar();

  const handleConnectGoogle = async () => {
    const clerkUser = user as ClerkUserWithExternalAccounts | null;
    if (!clerkUser) return;

    try {
      const agendaUrl = `${window.location.origin}/agenda`;
      const redirectUrl = `${window.location.origin}/sso-callback?redirect_url=${encodeURIComponent(agendaUrl)}`;
      const googleAccount = clerkUser.externalAccounts?.find(
        (account) => account.provider === "google",
      );

      let accountResult: ClerkExternalAccount | null | undefined;

      if (googleAccount?.reauthorize) {
        const approvedScopes = new Set(googleAccount.approvedScopes || []);
        const missingScopes = GOOGLE_CALENDAR_SCOPES.filter((scope) => !approvedScopes.has(scope));

        accountResult = await googleAccount.reauthorize({
          additionalScopes: missingScopes.length > 0 ? missingScopes : GOOGLE_CALENDAR_SCOPES,
          redirectUrl,
        });
      } else if (clerkUser.createExternalAccount) {
        accountResult = await clerkUser.createExternalAccount({
          strategy: "oauth_google",
          redirectUrl,
          additionalScopes: GOOGLE_CALENDAR_SCOPES,
        });
      }

      const verificationRedirectUrl = getExternalRedirectUrl(accountResult);
      if (!verificationRedirectUrl) {
        throw new Error("Clerk nao retornou URL de autorizacao do Google");
      }

      window.location.href = verificationRedirectUrl;
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
        toast.error("Nao foi possivel carregar empresas para associacao na agenda");
        return;
      }

      setProjects((data || []) as unknown as Project[]);
    };

    void loadProjects();
  }, [user]);

  useEffect(() => {
    if (DEV_AUTH_USER_ID) return;
    if (!user) return;

    const checkAndStoreGoogleToken = async () => {
      if (connected) return;

      try {
        const googleToken = await getToken({ template: "oauth_google" });
        if (googleToken) {
          await storeGoogleToken(googleToken);
          toast.success("Google Calendar conectado");
          await fetchEvents();
        }
      } catch (err) {
        console.error("Error getting Google token:", err);
      }
    };

    void checkAndStoreGoogleToken();
  }, [connected, fetchEvents, getToken, storeGoogleToken, user]);

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
      toast.error("Nao foi possivel salvar preferencia de agenda");
    });
  };

  const priorityOptions = PRIORITIES.map((item) => item.value);

  const availableTags = useMemo(() => {
    return [...new Set(events.flatMap((event) => event.tags))].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (!preferences.showDeclined && event.selfResponseStatus === "declined") return false;
      if (!statusMatchesFilter(event, preferences.statusFilter)) return false;

      if (preferences.priorityFilter.length > 0 && !preferences.priorityFilter.includes(event.priority)) {
        return false;
      }

      if (preferences.tagFilter.length > 0) {
        const hasTag = preferences.tagFilter.some((tag) => event.tags.includes(tag));
        if (!hasTag) return false;
      }

      return true;
    });

    const byTime = (a: CalendarEvent, b: CalendarEvent) => parseISO(a.start).getTime() - parseISO(b.start).getTime();

    if (preferences.sortMode === "time_only") {
      return filtered.sort(byTime);
    }

    return filtered.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return byTime(a, b);
    });
  }, [events, preferences]);

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
      toast.success(status === "accepted" ? "Reuniao aceita" : "Reuniao recusada");
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
      toast.error("Titulo da reuniao e obrigatorio");
      return;
    }

    const startIso = new Date(`${meetingDate}T${meetingStartTime}:00`).toISOString();
    const endIso = new Date(`${meetingDate}T${meetingEndTime}:00`).toISOString();

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      toast.error("Horario final precisa ser maior que o inicial");
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

      toast.success("Reuniao criada no Google Calendar");
      setMeetingDialogOpen(false);
      setMeetingSummary("");
      setMeetingDescription("");
      setMeetingLocation("");
      setMeetingAttendees("");
      setCreateMeetLink(true);
    } catch (err) {
      toast.error((err as Error).message || "Erro ao criar reuniao");
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
            Veja eventos, responda convites e crie reunioes direto no WorkOS.
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
    <div className="space-y-6">
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
                Nova reuniao
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Criar reuniao</DialogTitle>
                <DialogDescription>Crie reuniao no Google Calendar com convidados e Google Meet opcional.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titulo</Label>
                  <Input value={meetingSummary} onChange={(event) => setMeetingSummary(event.target.value)} placeholder="Assunto da reuniao" />
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
                  <Label>Descricao</Label>
                  <Textarea
                    value={meetingDescription}
                    onChange={(event) => setMeetingDescription(event.target.value)}
                    placeholder="Pauta da reuniao"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Criar link Google Meet</p>
                    <p className="text-xs text-muted-foreground">Ative para gerar videoconferencia automaticamente</p>
                  </div>
                  <Switch checked={createMeetLink} onCheckedChange={setCreateMeetLink} />
                </div>

                <Button onClick={() => void handleCreateMeeting()} className="w-full" disabled={creatingMeeting}>
                  {creatingMeeting ? "Criando..." : "Criar reuniao"}
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

      {(insufficientScope || error) && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error || "Permissao insuficiente no Google Calendar para escrita."}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleConnectGoogle}>
            Reconectar Google
          </Button>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pendentes</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.pending}</p>
            <p className="text-xs text-muted-foreground">Convites aguardando sua resposta.</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Em andamento</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.live}</p>
            <p className="text-xs text-muted-foreground">Reunioes acontecendo agora.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Confirmadas</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.confirmed}</p>
            <p className="text-xs text-muted-foreground">Proximas reunioes ja aceitas.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Encerradas</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{agendaSummary.past}</p>
            <p className="text-xs text-muted-foreground">Eventos que ja aconteceram.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <Select
              value={preferences.statusFilter}
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
                <SelectItem value="priority_then_time">Prioridade e horario</SelectItem>
                <SelectItem value="time_only">Somente horario</SelectItem>
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
          {days.map(({ date, events: dayEvents, groupedEvents }) => (
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
                    description="Reunioes que ainda precisam da sua confirmacao."
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
                    title="Proximas ja aceitas"
                    description="Reunioes futuras que ja estao confirmadas."
                    count={groupedEvents.confirmed.length}
                    events={groupedEvents.confirmed}
                    projects={projects}
                    respondingEventId={respondingEventId}
                    savingSeriesKey={savingSeriesKey}
                    onRespond={handleRespond}
                    onSaveMetadata={handleSaveMetadata}
                  />
                  <AgendaGroup
                    title="Ja encerradas"
                    description="Historico do que ja aconteceu neste dia."
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




