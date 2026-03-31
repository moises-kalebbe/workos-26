import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Briefcase,
  Calculator,
  Camera,
  Clock3,
  Globe,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/system/empty-state";
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

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof User;
  accent?: "default" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/95 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={accent === "success" ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-primary"} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function getAvatarHint(value: string) {
  if (!value) return "Sem avatar configurado";
  if (value.startsWith("data:")) return "Imagem embutida salva no perfil";
  return "Avatar carregado por URL externa";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [editProjectDialog, setEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editColor, setEditColor] = useState("#8b5cf6");

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

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const [profileRes, projRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      db.from("projects").select("*").order("name"),
    ]);

    const nextProfile = profileRes.data as Profile | null;
    if (nextProfile) {
      setProfile(nextProfile);
      setName(nextProfile.name || "");
      setTimezone(nextProfile.timezone || "America/Sao_Paulo");
      setAvatarUrl(nextProfile.avatar_url || "");
    }

    setProjects((projRes.data || []) as Project[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const requestedTab = searchParams.get("tab");
    const requestedProject = searchParams.get("project");

    if (requestedTab === "companies" || requestedTab === "profile" || requestedTab === "preferences") {
      setActiveTab(requestedTab);
    }

    if (requestedProject) {
      setRequestedProjectId(requestedProject);
    }
  }, []);

  useEffect(() => {
    if (!requestedProjectId || projects.length === 0) return;
    const requestedProject = projects.find((project) => project.id === requestedProjectId);
    if (!requestedProject) return;
    setActiveTab("companies");
    openEditProject(requestedProject);
    setRequestedProjectId(null);
  }, [projects, requestedProjectId]);

  useEffect(() => {
    if (projects.length === 0) {
      setCalculatorProjectId("");
      return;
    }

    const selectedProject = projects.find((project) => project.id === calculatorProjectId);
    if (!selectedProject) {
      hydrateCalculator(projects[0]);
    }
  }, [calculatorProjectId, projects]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);

    const { error } = await db
      .from("profiles")
      .update({
        name,
        timezone,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast.success("Perfil salvo");
      await loadData();
    }

    setSaving(false);
  }

  async function createProject() {
    if (!newName || !user) return;

    const { error } = await db.from("projects").insert({
      user_id: user.id,
      name: newName,
      client: newClient || null,
      hourly_rate: parseFloat(newRate) || 0,
      color: newColor,
    });

    if (error) {
      toast.error("Erro ao criar empresa");
    } else {
      toast.success("Empresa criada");
      setNewProjectDialog(false);
      setNewName("");
      setNewClient("");
      setNewRate("");
      setNewColor("#8b5cf6");
      await loadData();
    }
  }

  async function updateProject() {
    if (!editingProject || !editName) return;

    const { error } = await db
      .from("projects")
      .update({
        name: editName,
        client: editClient || null,
        hourly_rate: parseFloat(editRate) || 0,
        color: editColor,
      })
      .eq("id", editingProject.id);

    if (error) {
      toast.error("Erro ao atualizar empresa");
    } else {
      toast.success("Empresa atualizada");
      setEditProjectDialog(false);
      await loadData();
    }
  }

  async function deleteProject(projectId: string) {
    await db.from("time_sessions").delete().eq("project_id", projectId);
    const { error } = await db.from("projects").delete().eq("id", projectId);

    if (error) {
      toast.error("Erro ao excluir empresa");
    } else {
      toast.success("Empresa excluida");
      await loadData();
    }
  }

  function openEditProject(project: Project) {
    setEditingProject(project);
    setEditName(project.name);
    setEditClient(project.client || "");
    setEditRate(String(project.hourly_rate));
    setEditColor(project.color);
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
    setSelectedWorkdays((prev) => (prev.includes(workday) ? prev.filter((value) => value !== workday) : [...prev, workday]));
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
    const { error } = await db
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
      toast.success("Calculo salvo na empresa");
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

  const configuredContracts = useMemo(
    () => projects.filter((project) => Boolean(project.monthly_agreed_amount)).length,
    [projects],
  );

  const averageHourlyRate = useMemo(() => {
    const projectsWithRate = projects.filter((project) => project.hourly_rate > 0);
    if (projectsWithRate.length === 0) return 0;
    return projectsWithRate.reduce((sum, project) => sum + project.hourly_rate, 0) / projectsWithRate.length;
  }, [projects]);

  const initials = (name || user?.primaryEmailAddress?.emailAddress || "U").charAt(0).toUpperCase();
  const timezoneLabel = TIMEZONES.find((item) => item.value === timezone)?.label || timezone;

  if (loading) {
    return <LoadingState message="Carregando configuracoes..." />;
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Configuracoes"
        description="Ajuste perfil, empresas e preferencias sem perder contexto da operacao."
      />

      <section className="grid gap-3 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr]">
        <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(8,18,38,0.96),rgba(15,25,44,0.92))] p-5 shadow-[0_20px_60px_-40px_rgba(34,211,238,0.5)]">
          <div className="flex items-center gap-2 text-cyan-200/80">
            <Activity className="h-4 w-4 text-cyan-300" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Area da conta</p>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <Avatar className="h-16 w-16 border border-white/10">
              <AvatarImage src={avatarUrl || undefined} alt={name || "Perfil"} />
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">{name || "Perfil sem nome"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || "Sem email"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{profile?.plan || "Free"}</Badge>
                <Badge variant="secondary" className="bg-background/40 text-muted-foreground">
                  {timezoneLabel}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
              {projects.length} empresas cadastradas
            </span>
            <span className="rounded-full border border-border/70 bg-background/30 px-2.5 py-1">
              {configuredContracts} contratos configurados
            </span>
          </div>
        </div>

        <SummaryCard
          label="Empresas"
          value={String(projects.length).padStart(2, "0")}
          helper="Base atual para tracker, kanban e relatorios"
          icon={Briefcase}
        />
        <SummaryCard
          label="Taxa media"
          value={averageHourlyRate > 0 ? formatMoney(averageHourlyRate) : "--"}
          helper="Media do valor/hora salvo nas empresas"
          icon={Wallet}
          accent="success"
        />
        <SummaryCard
          label="Timezone"
          value={new Date().toLocaleTimeString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}
          helper={timezoneLabel}
          icon={Clock3}
        />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-auto rounded-2xl border border-border bg-card p-1">
          <TabsTrigger value="profile" className="gap-2 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Briefcase className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Globe className="h-4 w-4" />
            Preferencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border bg-card/95 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Identidade</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Como sua conta aparece</h2>

              <div className="mt-5 flex flex-col items-start gap-4">
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={avatarUrl || undefined} alt={name || "Perfil"} />
                  <AvatarFallback className="bg-primary/15 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>

                <div>
                  <p className="text-base font-semibold text-foreground">{name || "Sem nome definido"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>

                <div className="w-full rounded-xl border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Avatar atual</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{getAvatarHint(avatarUrl)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/95 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Dados do perfil</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Atualize nome, avatar e conta base</h2>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    className="h-11 rounded-2xl border-border bg-background/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fonte do avatar</Label>
                  <Input
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://... ou data:image/..."
                    className="h-11 rounded-2xl border-border bg-background/60 font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usar `data:image/...`, o perfil continua funcionando, mas a URL fica longa. Prefira URL publica quando puder.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={user?.primaryEmailAddress?.emailAddress || ""} disabled className="h-11 rounded-2xl border-border bg-background/40 opacity-70" />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button onClick={saveProfile} disabled={saving} className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar perfil"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Salva nome, avatar e timezone da conta.</span>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="companies" className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Empresas e contratos</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Mantenha base comercial e financeira organizada</h2>
            </div>

            <Button onClick={() => setNewProjectDialog(true)} className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Nova empresa
            </Button>
          </div>

          <section className="rounded-2xl border border-border bg-card/95 p-5">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Calculadora de contrato</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">Defina valor/hora e valor/dia sem conta manual</h3>
              </div>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Informe valor mensal e carga esperada para salvar automaticamente os campos financeiros na empresa.
            </p>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Empresa</Label>
                    <Select value={calculatorProjectId || undefined} onValueChange={handleCalculatorProjectChange}>
                      <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
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
                    <Label className="text-xs text-muted-foreground">Valor mensal acordado</Label>
                    <Input
                      type="number"
                      value={monthlyAmount}
                      onChange={(event) => setMonthlyAmount(event.target.value)}
                      placeholder="0"
                      className="h-11 rounded-2xl border-border bg-background/60 font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Horas no mes</Label>
                    <Input
                      type="number"
                      value={monthlyHours}
                      onChange={(event) => setMonthlyHours(event.target.value)}
                      placeholder="160"
                      className="h-11 rounded-2xl border-border bg-background/60 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Horas por dia</Label>
                    <Input
                      type="number"
                      value={dailyHours}
                      onChange={(event) => setDailyHours(event.target.value)}
                      placeholder="8"
                      className="h-11 rounded-2xl border-border bg-background/60 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Dias trabalhados por semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {WORKDAY_OPTIONS.map((workday) => {
                      const active = selectedWorkdays.includes(workday.value);
                      return (
                        <button
                          key={workday.value}
                          type="button"
                          onClick={() => toggleWorkday(workday.value)}
                          className={active
                            ? "rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
                            : "rounded-full border border-border bg-background/40 px-3 py-2 text-xs font-medium text-muted-foreground"}
                        >
                          {workday.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor por hora</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {calculatorResult.hourlyRate ? formatMoney(roundToMoney(calculatorResult.hourlyRate)) : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valor por dia</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {calculatorResult.dailyRate ? formatMoney(roundToMoney(calculatorResult.dailyRate)) : "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Horas por dia</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {calculatorResult.hoursPerDay ? `${calculatorResult.hoursPerDay.toFixed(2)}h` : "--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={saveProjectContract}
                disabled={savingCalculator || !calculatorProjectId}
                className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                {savingCalculator ? "Salvando calculo..." : "Salvar calculo na empresa"}
              </Button>
              <span className="text-xs text-muted-foreground">Atualiza valor/hora, valor/dia, horas e dias de trabalho da empresa escolhida.</span>
            </div>
          </section>

          {projects.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nenhuma empresa cadastrada"
              description="Crie a primeira empresa para organizar tracker, kanban e relatorios a partir dela."
            />
          ) : (
            <section className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-border bg-card/95 p-5 transition-colors hover:border-primary/20">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: project.color }} />
                        <h3 className="truncate text-lg font-semibold text-foreground">{project.name}</h3>
                        <Badge variant="secondary" className="bg-background/60 text-muted-foreground">
                          {project.status}
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{project.client || "Sem cliente definido"}</span>
                        <span>{formatMoney(project.hourly_rate)}/h</span>
                        {project.daily_rate ? <span>{formatMoney(project.daily_rate)}/dia</span> : null}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                      <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contrato mensal</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {project.monthly_agreed_amount ? formatMoney(project.monthly_agreed_amount) : "--"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/35 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dias por semana</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {project.workdays?.length ? `${project.workdays.length} dias` : "--"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-background/60 px-2.5 py-1">
                        {project.monthly_agreed_hours ? `${project.monthly_agreed_hours}h mes` : "Sem horas mensais"}
                      </span>
                      <span className="rounded-full bg-background/60 px-2.5 py-1">
                        {project.daily_agreed_hours ? `${project.daily_agreed_hours}h dia` : "Sem horas por dia"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditProject(project)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProject(project.id)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-border bg-card/95 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Preferencias gerais</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Timezone e comportamento da conta</h2>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="h-11 rounded-2xl border-border bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Horario local</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {new Date().toLocaleTimeString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{timezoneLabel}</p>
                </div>

                <Button onClick={saveProfile} disabled={saving} className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar preferencias"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/95 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Plano</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Situacao atual da conta</h2>

              <div className="mt-5 rounded-xl border border-border/70 bg-background/35 p-4">
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{profile?.plan || "Free"}</Badge>
                <p className="mt-3 text-sm text-muted-foreground">
                  Plano atual da conta. Esta area pode crescer depois com billing e limites, mas ja fica mais clara e organizada.
                </p>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome da empresa" className="h-11 rounded-2xl border-border bg-background/60" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input value={newClient} onChange={(event) => setNewClient(event.target.value)} placeholder="Cliente associado" className="h-11 rounded-2xl border-border bg-background/60" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">R$/hora</Label>
                <Input type="number" value={newRate} onChange={(event) => setNewRate(event.target.value)} placeholder="0" className="h-11 rounded-2xl border-border bg-background/60 font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={newColor === color ? "h-9 w-9 rounded-xl ring-2 ring-foreground scale-110 transition-all" : "h-9 w-9 rounded-xl transition-all"}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={createProject} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
              Criar empresa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editProjectDialog} onOpenChange={setEditProjectDialog}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={editName} onChange={(event) => setEditName(event.target.value)} className="h-11 rounded-2xl border-border bg-background/60" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input value={editClient} onChange={(event) => setEditClient(event.target.value)} className="h-11 rounded-2xl border-border bg-background/60" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">R$/hora</Label>
                <Input type="number" value={editRate} onChange={(event) => setEditRate(event.target.value)} className="h-11 rounded-2xl border-border bg-background/60 font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={editColor === color ? "h-9 w-9 rounded-xl ring-2 ring-foreground scale-110 transition-all" : "h-9 w-9 rounded-xl transition-all"}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={updateProject} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar alteracoes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
