import { useState, useEffect } from "react";
import { Settings, User, Globe, Briefcase, Loader2, Camera, Trash2, Pencil, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/utils";
import { toast } from "sonner";
import type { Profile, Project } from "@/types";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Noronha (GMT-2)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0)" },
];

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

  const COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

  useEffect(() => {
    if (user) loadData();
  }, [user]);

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
      toast.success("Empresa excluída!");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Briefcase className="h-4 w-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Globe className="h-4 w-4" /> Preferências
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-6">Informações do Perfil</h2>

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
                        {p.client || "Sem cliente"} · {formatMoney(p.hourly_rate)}/h · {p.status}
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
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
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
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
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
                  Salvar Alterações
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-6">Fuso Horário</h2>
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
                Horário atual: {new Date().toLocaleTimeString("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })} ({timezone})
              </p>
              <Button onClick={saveProfile} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Plano Atual</h2>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                {profile?.plan || "Free"}
              </span>
              <p className="text-xs text-muted-foreground">Plano gratuito com funcionalidades básicas</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
