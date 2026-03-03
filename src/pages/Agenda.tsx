import { useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  ExternalLink,
  Link2Off,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleCalendar, CalendarEvent } from "@/hooks/useGoogleCalendar";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

function EventCard({ event }: { event: CalendarEvent }) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);

  return (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-3 py-2 text-center min-w-[56px]">
        <span className="text-[11px] font-semibold uppercase text-primary">
          {format(startDate, "MMM", { locale: ptBR })}
        </span>
        <span className="text-xl font-bold text-foreground leading-tight">
          {format(startDate, "dd")}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{event.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {event.allDay
              ? "Dia inteiro"
              : `${format(startDate, "HH:mm")} – ${format(endDate, "HH:mm")}`}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              {event.location}
            </span>
          )}
        </div>
        {event.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
    </a>
  );
}

export default function AgendaPage() {
  const { events, loading, connected, error, connectGoogle, disconnect, fetchEvents } =
    useGoogleCalendar();
  const [weekOffset, setWeekOffset] = useState(0);

  const currentDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const handleWeekChange = (dir: number) => {
    const newOffset = weekOffset + dir;
    setWeekOffset(newOffset);
    const newDate = addWeeks(new Date(), newOffset);
    const ws = startOfWeek(newDate, { weekStartsOn: 1 });
    const we = endOfWeek(newDate, { weekStartsOn: 1 });
    fetchEvents(ws.toISOString(), we.toISOString());
  };

  // Group events by day
  const days: { date: Date; events: CalendarEvent[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push({
      date: day,
      events: events.filter((e) => {
        const eDate = parseISO(e.start);
        return isSameDay(eDate, day);
      }),
    });
  }

  if (!connected && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">Seus compromissos e eventos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CalendarDays className="h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            Conecte seu Google Calendar
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Veja seus eventos e compromissos diretamente no WorkOS. Seus dados ficam seguros — usamos apenas permissão de leitura.
          </p>
          {error && (
            <p className="text-sm text-danger mb-4">{error}</p>
          )}
          <Button onClick={connectGoogle} className="gap-2">
            <Calendar className="h-4 w-4" />
            Conectar Google Calendar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, "dd MMM", { locale: ptBR })} –{" "}
            {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleWeekChange(-1)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWeekOffset(0);
              const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
              const we = endOfWeek(new Date(), { weekStartsOn: 1 });
              fetchEvents(ws.toISOString(), we.toISOString());
            }}
            className="text-xs"
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleWeekChange(1)}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchEvents(weekStart.toISOString(), weekEnd.toISOString())}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            className="text-xs text-muted-foreground gap-1"
          >
            <Link2Off className="h-3 w-3" />
            Desconectar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(({ date, events: dayEvents }) => (
            <div key={date.toISOString()}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-sm font-semibold ${
                    isToday(date) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                {isToday(date) && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
                    Hoje
                  </span>
                )}
              </div>
              {dayEvents.length > 0 ? (
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic pl-1">
                  Nenhum evento
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
