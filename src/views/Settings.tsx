import { useState, useEffect } from "react";
import { Settings, User, Globe, Briefcase, Loader2, Camera, Trash2, Pencil, Plus, Save, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { formatMoney } from "@/lib/utils";
import { calculateProjectContract } from "@/lib/projectContract";
import { PROJECT_COLORS } from "@/lib/projectColors";
import { TIMEZONES } from "@/config/timezones";
import { WORKDAY_OPTIONS } from "@/config/workdays";
import { toast } from "sonner";
import type { Profile, Project } from "@/types";

function parsePositiveNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function roundToMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Project edit
  const [editProjectDialog, setEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editColor, setEditColor] = useState("#8b5cf6");

  // New project
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");
  const [calculatorProjectId, setCalculatorProjectId] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [monthlyHours, setMonthlyHours] = useState("");
  const [dailyHours, setDailyHours] = useState("");
  const [selectedWorkdays, setSelectedWorkdays] = useState<string[]>([]);
  const [savingCalculator, setSavingCalculator] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (projects.length === 0) {
      setCalculatorProjectId("");
      return;
    }

    const selectedProject = projects.find((project) => project.id === calculatorProjectId);
    if (selectedProject) return;

    hydrateCalculator(projects[0]);
  }, [projects, calculatorProjectId]);

  async function loadData() {
    setLoading(true);
    const [profileRes, projRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      supabase.from("projects").select("*").order("name"),
    ]);

    const p = profileRes.data as unknown as Profile | null;
    if (p) {
      setProfile(p);
      setName(p.name || "");
      setTimezone(p.timezone || "America/Sao_Paulo");
      setAvatarUrl(p.avatar_url || "");
    }

    setProjects((projRes.data || []) as unknown as Project[]);
    setLoading(false);
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase.from("profiles").update({
      name,
      timezone,
      avatar_url: avatarUrl || null,
    }).eq("id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast.success("Perfil salvo!");
    }
    setSaving(false);
  }

  async function createProject() {
    if (!newName || !user) return;
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      name: newName,
      client: newClient || null,
      hourly_rate: parseFloat(newRate) || 0,
      color: newColor,
    });
    if (error) {
      toast.error("Erro ao criar empresa");
    } else {
      toast.success("Empresa criada!");
      setNewProjectDialog(false);
      setNewName(""); setNewClient(""); setNewRate("");
      loadData();
    }
  }

  async function updateProject() {
    if (!editingProject || !editName) return;
    const { error } = await supabase.from("projects").update({
      name: editName,
      client: editClient || null,
      hourly_rate: parseFloat(editRate) || 0,
      color: editColor,
    }).eq("id", editingProject.id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      toast.success("Empresa atualizada!");
      setEditProjectDialog(false);
      loadData();
    }
  }

  async function deleteProject(projectId: string) {
    await supabase.from("time_sessions").delete().eq("project_id", projectId);
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Empresa excluida!");
      loadData();
    }
  }

  function openEditProject(p: Project) {
    setEditingProject(p);
    setEditName(p.name);
    setEditClient(p.client || "");
    setEditRate(String(p.hourly_rate));
    setEditColor(p.color);
    setEditProjectDialog(true);
  }

  function hydrateCalculator(project: Project) {
    setCalculatorProjectId(project.id);
    setMonthlyAmount(project.monthly_agreed_amount ? String(project.monthly_agreed_amount) : "");
    setMonthlyHours(project.monthly_agreed_hours ? String(project.monthly_agreed_hours) : "");
    setDailyHours(project.daily_agreed_hours ? String(project.daily_agreed_hours) : "");
    setSelectedWorkdays(project.workdays || []);
  }

  function handleCalculatorProjectChange(projectId: string) {
    const selected = projects.find((project) => project.id === projectId);
    if (!selected) return;
    hydrateCalculator(selected);
  }

  function toggleWorkday(workday: string) {
    setSelectedWorkdays((prev) => {
      if (prev.includes(workday)) {
        return prev.filter((value) => value !== workday);
      }
      return [...prev, workday];
    });
  }

  async function saveProjectContract() {
    if (!calculatorProjectId) {
      toast.error("Selecione uma empresa");
      return;
    }

    const monthlyAmountValue = parsePositiveNumber(monthlyAmount);
    const monthlyHoursValue = parsePositiveNumber(monthlyHours);
    const dailyHoursValue = parsePositiveNumber(dailyHours);

    if (!monthlyAmountValue) {
      toast.error("Informe o valor mensal acordado");
      return;
    }

    if (!monthlyHoursValue && !dailyHoursValue) {
      toast.error("Informe as horas mensais ou as horas por dia");
      return;
    }

    if (selectedWorkdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana");
      return;
    }

    const result = calculateProjectContract({
      monthlyAmount: monthlyAmountValue,
      monthlyHours: monthlyHoursValue,
      dailyHours: dailyHoursValue,
      workdays: selectedWorkdays,
    });

    if (!result.hourlyRate || !result.dailyRate) {
      toast.error("Nao foi possivel calcular os valores");
      return;
    }

    setSavingCalculator(true);
    const { error } = await supabase
      .from("projects")
      .update({
        monthly_agreed_amount: roundToMoney(monthlyAmountValue),
        monthly_agreed_hours: monthlyHoursValue ? roundToMoney(monthlyHoursValue) : null,
        daily_agreed_hours: dailyHoursValue ? roundToMoney(dailyHoursValue) : null,
        workdays: selectedWorkdays,
        daily_rate: roundToMoney(result.dailyRate),
        hourly_rate: roundToMoney(result.hourlyRate),
      })
      .eq("id", calculatorProjectId);

    if (error) {
      toast.error("Erro ao salvar calculadora");
    } else {
      toast.success("Calculo salvo na empresa!");
      await loadData();
    }
    setSavingCalculator(false);
  }

  const monthlyAmountValue = parsePositiveNumber(monthlyAmount);
  const monthlyHoursValue = parsePositiveNumber(monthlyHours);
  const dailyHoursValue = parsePositiveNumber(dailyHours);
  const calculatorResult = calculateProjectContract({
    monthlyAmount: monthlyAmountValue,
    monthlyHours: monthlyHoursValue,
    dailyHours: dailyHoursValue,
    workdays: selectedWorkdays,
  });

  if (loading) {
    return <LoadingState message="Carregando configuracoes..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="Gerencie perfil, empresas, contratos e preferencias gerais da conta."
      />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Briefcase className="h-4 w-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Globe className="h-4 w-4" /> Preferencias
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-6">Informacoes do Perfil</h2>

            {/* Avatar */}
            <div className="flex items-center gap-6 mb-6">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary border-2 border-border">
                    {(name || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                  <input
                    type="text"
                    className="hidden"
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="bg-background border-border" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL do Avatar</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={user?.email || ""} disabled className="bg-background border-border opacity-60" />
              </div>

              <Button onClick={saveProfile} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Perfil"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Empresas / Projetos</h2>
            <Button onClick={() => setNewProjectDialog(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Nova Empresa
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Calculadora de Horas</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Defina contrato mensal e dias de trabalho para salvar valor por hora e valor por dia na empresa.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={calculatorProjectId || undefined} onValueChange={handleCalculatorProjectChange}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Valor acordado no mes (R$)</Label>
                <Input
                  type="number"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="0"
                  className="bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Horas acordadas no mes (opcional)</Label>
                <Input
                  type="number"
                  value={monthlyHours}
                  onChange={(e) => setMonthlyHours(e.target.value)}
                  placeholder="160"
                  className="bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Horas por dia (use se nao houver horas mensais)</Label>
                <Input
                  type="number"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                  placeholder="8"
                  className="bg-background border-border font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dias trabalhados na semana</Label>
              <div className="flex flex-wrap gap-2">
                {WORKDAY_OPTIONS.map((workday) => {
                  const active = selectedWorkdays.includes(workday.value);
                  return (
                    <button
                      key={workday.value}
                      type="button"
                      onClick={() => toggleWorkday(workday.value)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      {workday.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedWorkdays.length} dia(s) por semana
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor por hora</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {calculatorResult.hourlyRate ? formatMoney(roundToMoney(calculatorResult.hourlyRate)) : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor por dia</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {calculatorResult.dailyRate ? formatMoney(roundToMoney(calculatorResult.dailyRate)) : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Horas por dia</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {calculatorResult.hoursPerDay ? `${calculatorResult.hoursPerDay.toFixed(2)}h` : "--"}
                </p>
              </div>
            </div>

            <Button
              onClick={saveProjectContract}
              disabled={savingCalculator || !calculatorProjectId}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingCalculator ? "Salvando calculo..." : "Salvar calculo na empresa"}
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-1">Nenhuma empresa</p>
              <p className="text-sm text-muted-foreground">Adicione empresas para organizar seu trabalho</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between group hover:border-muted-foreground/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.client || "Sem cliente"} Â· {formatMoney(p.hourly_rate)}/h Â· {p.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditProject(p)} className="p-2 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteProject(p.id)} className="p-2 text-muted-foreground hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Project Dialog */}
          <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Nova Empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da empresa" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Cliente associado" className="bg-background border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">R$/hora</Label>
                    <Input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="0" className="bg-background border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cor</Label>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={`h-8 w-8 rounded-lg transition-all ${newColor === c ? "ring-2 ring-foreground scale-110" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={createProject} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Criar Empresa
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Project Dialog */}
          <Dialog open={editProjectDialog} onOpenChange={setEditProjectDialog}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Editar Empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} className="bg-background border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">R$/hora</Label>
                    <Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} className="bg-background border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cor</Label>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`h-8 w-8 rounded-lg transition-all ${editColor === c ? "ring-2 ring-foreground scale-110" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={updateProject} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Salvar Alteracoes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-6">Fuso Horario</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Horario atual: {new Date().toLocaleTimeString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })} ({timezone})
              </p>
              <Button onClick={saveProfile} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Preferencias"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Plano Atual</h2>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                {profile?.plan || "Free"}
              </span>
              <p className="text-xs text-muted-foreground">Plano gratuito com funcionalidades basicas</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}




