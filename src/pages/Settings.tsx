import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-1">Em breve</p>
        <p className="text-sm text-muted-foreground">
          Configurações de perfil, timezone e plano
        </p>
      </div>
    </div>
  );
}
