import { Calendar } from "lucide-react";

export default function AgendaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <p className="text-sm text-muted-foreground">Seus compromissos e eventos</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-1">Integração Google Calendar</p>
        <p className="text-sm text-muted-foreground">
          Em breve: conecte seu Google Calendar para ver seus eventos aqui
        </p>
      </div>
    </div>
  );
}
