import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Sparkles,
  RefreshCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { toast } from "sonner";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { GENERAL_MCP_SKILLS_SEED, getGeneralMcpSkillUpserts } from "@/lib/generalMcpSkills";
import {
  downloadBlob,
  downloadMarkdownFile,
  getUniqueSlug,
  parseMarkdownFile,
  sanitizeFileName,
  slugify,
} from "@/lib/markdown";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import type { Project, SkillCategory, SkillDocument } from "@/types";

type SkillSourceType = SkillDocument["source_type"];

type SeedCategory = {
  name: string;
  slug: string;
  description: string;
};

type SeedSkill = {
  title: string;
  slug: string;
  summary: string;
  categorySlug: string;
  steps: string[];
};

const SEED_CATEGORIES: SeedCategory[] = [
  { name: "AI-First Workflows", slug: "ai-first-workflows", description: "Automacao com IA para trabalho de alto valor." },
  { name: "Second Brain / PKM", slug: "second-brain-pkm", description: "Metodos para organizar conhecimento." },
  { name: "Foco e Tempo", slug: "foco-e-tempo", description: "Execução focada e blocos de trabalho." },
  { name: "Priorizacao", slug: "priorizacao", description: "Frameworks para decidir o próximo passo." },
  { name: "Habitos e Consistencia", slug: "habitos-consistencia", description: "Rotina para manter progresso continuo." },
];

const SEED_SKILLS: SeedSkill[] = [
  {
    title: "AI-First Workflow Basico",
    slug: "ai-first-workflow-basico",
    summary: "Fluxo prático para pesquisa, rascunho e revisão com IA.",
    categorySlug: "ai-first-workflows",
    steps: ["Definir resultado", "Gerar opções com IA", "Revisar fatos", "Publicar e aprender"],
  },
  {
    title: "PARA na prática",
    slug: "para-na-pratica",
    summary: "Projetos, Áreas, Recursos e Arquivo para reduzir caos.",
    categorySlug: "second-brain-pkm",
    steps: ["Capturar tudo", "Classificar em PARA", "Revisar semanalmente", "Arquivar sem medo"],
  },
  {
    title: "Zettelkasten + CODE",
    slug: "zettelkasten-code",
    summary: "Notas atomicas conectadas com ciclo de capturar e expressar.",
    categorySlug: "second-brain-pkm",
    steps: ["Uma ideia por nota", "Criar links", "Destilar", "Aplicar em projeto"],
  },
  {
    title: "Time Blocking + Deep Work",
    slug: "time-blocking-deep-work",
    summary: "Blocos de foco para tarefas de alta concentracao.",
    categorySlug: "foco-e-tempo",
    steps: ["Reservar blocos", "Evitar multitarefa", "Encerrar com próxima ação", "Revisar agenda"],
  },
  {
    title: "GTD Essencial",
    slug: "gtd-essencial",
    summary: "Capturar, clarificar, organizar, refletir e engajar.",
    categorySlug: "foco-e-tempo",
    steps: ["Capturar tudo", "Definir próxima ação", "Organizar listas", "Revisão semanal"],
  },
  {
    title: "Pomodoro e Time Boxing",
    slug: "pomodoro-time-boxing",
    summary: "Sprints curtos com pausa para manter energia.",
    categorySlug: "foco-e-tempo",
    steps: ["Definir bloco", "Executar foco", "Pausar", "Registrar progresso"],
  },
  {
    title: "Matriz de Eisenhower",
    slug: "matriz-eisenhower",
    summary: "Priorizar por urgencia e importancia.",
    categorySlug: "priorizacao",
    steps: ["Listar tarefas", "Classificar por quadrante", "Executar prioridade alta", "Eliminar ruído"],
  },
  {
    title: "Eat The Frog",
    slug: "eat-the-frog",
    summary: "Comecar pela tarefa mais dificil para destravar o dia.",
    categorySlug: "priorizacao",
    steps: ["Escolher frog na noite anterior", "Proteger primeiro bloco", "Concluir antes de mensagens", "Seguir plano"],
  },
  {
    title: "Dont Break the Chain",
    slug: "dont-break-the-chain",
    summary: "Consistencia diária com cadeia visual de habito.",
    categorySlug: "habitos-consistencia",
    steps: ["Definir habito mínimo", "Marcar execução diária", "Acompanhar sequência", "Retomar rápido apos falha"],
  },
];

const GENERAL_CATEGORY_SEED: SeedCategory = {
  name: "Geral",
  slug: "geral",
  description: "Skills gerais para operacao e automacao.",
};

function buildSeedMarkdown(skill: SeedSkill) {
  const steps = skill.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return `# ${skill.title}\n\n## Resumo\n${skill.summary}\n\n## Passos\n${steps}\n\n## Check de execucao\n- Objetivo claro\n- Proxima acao definida\n- Revisao semanal`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getSourceLabel(source: SkillSourceType) {
  if (source === "seed") return "Seed";
  if (source === "upload") return "Upload";
  return "Manual";
}

function getSeedFlagKey(userId: string) {
  return `workos.skills.seeded.${userId}`;
}

function hasSeededLocally(userId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getSeedFlagKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markSeededLocally(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getSeedFlagKey(userId), "1");
  } catch {
    // localStorage unavailable, skip
  }
}

export default function SkillsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skills, setSkills] = useState<SkillDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SkillCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillDocument | null>(null);
  const [skillTitle, setSkillTitle] = useState("");
  const [skillCategoryId, setSkillCategoryId] = useState("");
  const [skillSummary, setSkillSummary] = useState("");
  const [skillMarkdown, setSkillMarkdown] = useState("");
  const [skillSourceType, setSkillSourceType] = useState<SkillSourceType>("manual");
  const [skillProjectValue, setSkillProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [savingSkill, setSavingSkill] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<SkillCategory | null>(null);
  const [skillPendingDelete, setSkillPendingDelete] = useState<SkillDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const libraryStats = useMemo(() => {
    const manualCount = skills.filter((skill) => skill.source_type === "manual").length;
    const uploadCount = skills.filter((skill) => skill.source_type === "upload").length;
    const lastUpdatedSkill = [...skills].sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    })[0] || null;

    return {
      totalSkills: skills.length,
      totalCategories: categories.length,
      manualCount,
      uploadCount,
      lastUpdatedSkill,
    };
  }, [categories.length, skills]);

  const filteredSkills = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return skills.filter((skill) => {
      const matchesCategory = selectedCategoryId === "all" || skill.category_id === selectedCategoryId;
      if (!matchesCategory) return false;

      if (!searchTerm) return true;

      const haystack = `${skill.title}\n${skill.summary || ""}\n${skill.content_md}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [search, selectedCategoryId, skills]);

  const selectedSkill = useMemo(() => {
    const found = filteredSkills.find((skill) => skill.id === selectedSkillId);
    return found || filteredSkills[0] || null;
  }, [filteredSkills, selectedSkillId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const requestedSkillId = new URLSearchParams(window.location.search).get("skill");
    if (!requestedSkillId || skills.length === 0) return;

    const requestedSkill = skills.find((skill) => skill.id === requestedSkillId);
    if (!requestedSkill) return;

    setSelectedCategoryId(requestedSkill.category_id);
    setSelectedSkillId(requestedSkill.id);
  }, [skills]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!user) return;
    void bootstrap();
  }, [user]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function fetchData() {
    const [categoryRes, skillRes, projectRes] = await Promise.all([
      db.from("skill_categories").select("*").order("name"),
      db.from("skill_documents").select("*").order("updated_at", { ascending: false }),
      db.from("projects").select("*").order("name"),
    ]);

    if (categoryRes.error) throw categoryRes.error;
    if (skillRes.error) throw skillRes.error;
    if (projectRes.error) throw projectRes.error;

    const categoryRows = (categoryRes.data || []) as unknown as SkillCategory[];
    const skillRows = (skillRes.data || []) as unknown as SkillDocument[];
    const projectRows = (projectRes.data || []) as unknown as Project[];

    return { categoryRows, skillRows, projectRows };
  }

  async function bootstrap() {
    if (!user) return;
    setLoading(true);

    try {
      let currentData = await fetchData();
      const shouldAutoSeed =
        currentData.categoryRows.length === 0 &&
        currentData.skillRows.length === 0 &&
        !hasSeededLocally(user.id);

      if (shouldAutoSeed) {
        setSeeding(true);
        try {
          await seedInitialSkills(user.id);
          markSeededLocally(user.id);
          toast.success("Biblioteca inicial carregada");
          // Refresh data after seeding
          currentData = await fetchData();
        } catch (error) {
          toast.error((error as Error).message || "Falha ao gerar conteúdo inicial");
        } finally {
          setSeeding(false);
        }
      }

      try {
        const didAddGeneralMcpSkills = await ensureGeneralMcpSkills(user.id);
        if (didAddGeneralMcpSkills) {
          currentData = await fetchData();
        }
      } catch (error) {
        console.error("[skills] failed to ensure general MCP skills", error);
      }

      setCategories(currentData.categoryRows);
      setSkills(currentData.skillRows);
      setProjects(currentData.projectRows);

      if (currentData.categoryRows.length > 0 || currentData.skillRows.length > 0) {
        markSeededLocally(user.id);
      }

      if (currentData.skillRows.length > 0) {
        setSelectedSkillId((current) => current || currentData.skillRows[0].id);
      }
    } catch (error) {
      toast.error((error as Error).message || "Erro ao carregar skills");
    } finally {
      setLoading(false);
    }
  }

  async function seedInitialSkills(userId: string) {
    const categoryRows = SEED_CATEGORIES.map((category) => ({
      user_id: userId,
      name: category.name,
      slug: category.slug,
      description: category.description,
    }));

    const { data: upsertedCategories, error: categoryError } = await db
      .from("skill_categories")
      .upsert(categoryRows, { onConflict: "user_id,slug" })
      .select("id, slug");

    if (categoryError) throw categoryError;

    const categoryIdBySlug = new Map<string, string>();
    (upsertedCategories || []).forEach((category) => {
      categoryIdBySlug.set(category.slug, category.id);
    });

    const skillRows = SEED_SKILLS.map((skill) => {
      const categoryId = categoryIdBySlug.get(skill.categorySlug);
      if (!categoryId) {
        throw new Error(`Categoria de seed nao encontrada: ${skill.categorySlug}`);
      }

      return {
        user_id: userId,
        category_id: categoryId,
        title: skill.title,
        slug: skill.slug,
        summary: skill.summary,
        content_md: buildSeedMarkdown(skill),
        source_type: "seed" as SkillSourceType,
      };
    });

    const { error: skillError } = await db
      .from("skill_documents")
      .upsert(skillRows, { onConflict: "user_id,slug" });

    if (skillError) throw skillError;
  }

  async function ensureGeneralMcpSkills(userId: string) {
    const { data: categoryData, error: categoryError } = await db
      .from("skill_categories")
      .upsert({
        user_id: userId,
        name: GENERAL_CATEGORY_SEED.name,
        slug: GENERAL_CATEGORY_SEED.slug,
        description: GENERAL_CATEGORY_SEED.description,
      }, { onConflict: "user_id,slug" })
      .select("id")
      .single();

    if (categoryError) throw categoryError;
    if (!categoryData?.id) throw new Error("Categoria Geral não encontrada");

    const { data: existingSkills, error: existingSkillsError } = await db
      .from("skill_documents")
      .select("slug, title, summary, content_md, source_type, category_id")
      .eq("user_id", userId)
      .in(
        "slug",
        GENERAL_MCP_SKILLS_SEED.map((skill) => skill.slug),
      );

    if (existingSkillsError) throw existingSkillsError;

    const rows = getGeneralMcpSkillUpserts(
      ((existingSkills || []) as unknown as SkillDocument[]),
      userId,
      categoryData.id,
    );

    if (rows.length === 0) {
      return false;
    }

    const { error: upsertError } = await db
      .from("skill_documents")
      .upsert(rows, { onConflict: "user_id,slug" });

    if (upsertError) throw upsertError;
    return true;
  }

  function openCreateCategoryDialog() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryDialogOpen(true);
  }

  function openEditCategoryDialog(category: SkillCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setCategoryDialogOpen(true);
  }

  async function saveCategory() {
    if (!user) return;
    if (!categoryName.trim()) {
      toast.error("Nome da categoria e obrigatório");
      return;
    }

    const existingSlugs = categories
      .filter((category) => category.id !== editingCategory?.id)
      .map((category) => category.slug);
    const slug = getUniqueSlug(categoryName, existingSlugs);

    if (editingCategory) {
      const { error } = await db
        .from("skill_categories")
        .update({ name: categoryName.trim(), slug, description: categoryDescription.trim() || null })
        .eq("id", editingCategory.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Categoria atualizada");
    } else {
      const { data, error } = await db
        .from("skill_categories")
        .insert({
          user_id: user.id,
          name: categoryName.trim(),
          slug,
          description: categoryDescription.trim() || null,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.id) {
        setSelectedCategoryId(data.id);
      }

      toast.success("Categoria criada");
    }

    setCategoryDialogOpen(false);
    await bootstrap();
  }

  async function removeCategory(category: SkillCategory) {
    if (!user) return;

    const { error: skillDeleteError } = await db
      .from("skill_documents")
      .delete()
      .eq("category_id", category.id)
      .eq("user_id", user.id);

    if (skillDeleteError) {
      toast.error(skillDeleteError.message || "Falha ao remover skills da categoria");
      return;
    }

    const { data, error } = await db
      .from("skill_categories")
      .delete()
      .eq("id", category.id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data || data.length === 0) {
      toast.error("Categoria não encontrada para exclusão");
      return;
    }

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId("all");
    }

    toast.success("Categoria removida");
    await bootstrap();
  }

  function openCreateSkillDialog() {
    setEditingSkill(null);
    setSkillTitle("");
    setSkillSummary("");
    setSkillMarkdown("");
    setSkillSourceType("manual");
    setSkillProjectValue(GENERAL_PROJECT_VALUE);
    setSkillCategoryId(selectedCategoryId !== "all" ? selectedCategoryId : categories[0]?.id || "");
    setSkillDialogOpen(true);
  }

  function openEditSkillDialog(skill: SkillDocument) {
    setEditingSkill(skill);
    setSkillTitle(skill.title);
    setSkillSummary(skill.summary || "");
    setSkillMarkdown(skill.content_md);
    setSkillSourceType(skill.source_type);
    setSkillProjectValue(projectSelectValue(skill.project_id));
    setSkillCategoryId(skill.category_id);
    setSkillDialogOpen(true);
  }

  async function handleMarkdownUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseMarkdownFile(file);
      setSkillTitle(parsed.title);
      setSkillSummary((current) => current || parsed.summary || "");
      setSkillMarkdown(parsed.content);
      setSkillSourceType("upload");
      toast.success("Arquivo markdown importado");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao importar arquivo");
    } finally {
      event.target.value = "";
    }
  }

  async function saveSkill() {
    if (!user) return;
    if (!skillTitle.trim()) {
      toast.error("Título da skill e obrigatório");
      return;
    }
    if (!skillCategoryId) {
      toast.error("Selecione uma categoria");
      return;
    }
    if (!skillMarkdown.trim()) {
      toast.error("Conteúdo markdown e obrigatório");
      return;
    }

    setSavingSkill(true);

    const existingSlugs = skills
      .filter((skill) => skill.id !== editingSkill?.id)
      .map((skill) => skill.slug);
    const slug = getUniqueSlug(skillTitle, existingSlugs);

    try {
      if (editingSkill) {
        const { error } = await db
          .from("skill_documents")
          .update({
            title: skillTitle.trim(),
            slug,
            category_id: skillCategoryId,
            project_id: projectIdFromSelectValue(skillProjectValue),
            summary: skillSummary.trim() || null,
            content_md: skillMarkdown,
            source_type: skillSourceType,
          })
          .eq("id", editingSkill.id);

        if (error) throw error;
        toast.success("Skill atualizada");
      } else {
        const { data, error } = await db
          .from("skill_documents")
          .insert({
            user_id: user.id,
            title: skillTitle.trim(),
            slug,
            category_id: skillCategoryId,
            project_id: projectIdFromSelectValue(skillProjectValue),
            summary: skillSummary.trim() || null,
            content_md: skillMarkdown,
            source_type: skillSourceType,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (data?.id) {
          setSelectedSkillId(data.id);
        }
        toast.success("Skill criada");
      }

      setSkillDialogOpen(false);
      await bootstrap();
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar skill");
    } finally {
      setSavingSkill(false);
    }
  }

  async function removeSkill(skill: SkillDocument) {
    if (!user) return;

    const { data, error } = await db
      .from("skill_documents")
      .delete()
      .eq("id", skill.id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data || data.length === 0) {
      toast.error("Skill não encontrada para exclusão");
      return;
    }

    if (selectedSkillId === skill.id) {
      setSelectedSkillId(null);
    }

    toast.success("Skill removida");
    await bootstrap();
  }

  async function handleDownloadSkill(skill: SkillDocument) {
    downloadMarkdownFile(skill.title, skill.content_md);

    await db
      .from("skill_documents")
      .update({ last_downloaded_at: new Date().toISOString() })
      .eq("id", skill.id);

    toast.success("Download iniciado");
  }

  async function handleDownloadCategoryZip(categoryId: string) {
    const selectedCategory = categories.find((category) => category.id === categoryId);
    if (!selectedCategory) return;

    const categorySkills = skills.filter((skill) => skill.category_id === categoryId);
    if (categorySkills.length === 0) {
      toast.error("Categoria sem skills para download");
      return;
    }

    const zip = new JSZip();
    categorySkills.forEach((skill) => {
      const fileName = `${sanitizeFileName(skill.title) || slugify(skill.title) || "skill"}.md`;
      zip.file(fileName, skill.content_md);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const archiveName = `${sanitizeFileName(selectedCategory.name) || "skills"}-skills.zip`;
    downloadBlob(blob, archiveName);

    await db
      .from("skill_documents")
      .update({ last_downloaded_at: new Date().toISOString() })
      .in("id", categorySkills.map((skill) => skill.id));

    toast.success("Download da categoria iniciado");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        open={!!categoryPendingDelete}
        onOpenChange={(open) => {
          if (!open) setCategoryPendingDelete(null);
        }}
        itemLabel={`a categoria "${categoryPendingDelete?.name || ""}" e todas as skills dela`}
        onConfirm={async () => {
          if (!categoryPendingDelete) return;
          await removeCategory(categoryPendingDelete);
          setCategoryPendingDelete(null);
        }}
      />

      <DeleteConfirmDialog
        open={!!skillPendingDelete}
        onOpenChange={(open) => {
          if (!open) setSkillPendingDelete(null);
        }}
        itemLabel={`a skill "${skillPendingDelete?.title || ""}"`}
        onConfirm={async () => {
          if (!skillPendingDelete) return;
          await removeSkill(skillPendingDelete);
          setSkillPendingDelete(null);
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Skills Library</h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca privada de conhecimento em Markdown, organizada para busca, reutilização e ação rápida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void bootstrap()} className="gap-2" disabled={seeding}>
            <RefreshCcw className={cn("h-4 w-4", seeding && "animate-spin")} />
            Atualizar
          </Button>

          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openCreateCategoryDialog} className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Nova categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Editar categoria" : "Nova categoria"}</DialogTitle>
                <DialogDescription>Organize skills por tema para facilitar busca e download.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ex.: Produtividade"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={categoryDescription}
                    onChange={(event) => setCategoryDescription(event.target.value)}
                    placeholder="Contexto da categoria"
                    className="min-h-20"
                  />
                </div>

                <Button onClick={() => void saveCategory()} className="w-full">
                  {editingCategory ? "Salvar categoria" : "Criar categoria"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateSkillDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova skill
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingSkill ? "Editar skill" : "Nova skill"}</DialogTitle>
                <DialogDescription>Escreva no editor ou importe um arquivo Markdown.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={skillTitle}
                      onChange={(event) => setSkillTitle(event.target.value)}
                      placeholder="Nome da skill"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={skillCategoryId} onValueChange={setSkillCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={skillProjectValue} onValueChange={setSkillProjectValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Conhecimento geral" />
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Resumo</Label>
                  <Input
                    value={skillSummary}
                    onChange={(event) => setSkillSummary(event.target.value)}
                    placeholder="Descrição curta"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,text/markdown"
                    className="hidden"
                    onChange={(event) => {
                      void handleMarkdownUpload(event);
                    }}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Importar .md
                  </Button>

                  <Badge variant="outline">Fonte: {skillSourceType}</Badge>
                </div>

                <div className="space-y-2">
                  <Label>Markdown</Label>
                  <Textarea
                    value={skillMarkdown}
                    onChange={(event) => {
                      setSkillMarkdown(event.target.value);
                      if (skillSourceType !== "manual") {
                        setSkillSourceType("manual");
                      }
                    }}
                    className="min-h-[280px] font-mono text-xs"
                    placeholder="# Minha skill"
                  />
                </div>

                <Button onClick={() => void saveSkill()} className="w-full" disabled={savingSkill}>
                  {savingSkill ? "Salvando..." : editingSkill ? "Salvar alteracoes" : "Criar skill"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Skills</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{libraryStats.totalSkills}</p>
          <p className="mt-1 text-xs text-muted-foreground">Itens prontos para consulta e download.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Categorias</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{libraryStats.totalCategories}</p>
          <p className="mt-1 text-xs text-muted-foreground">Grupos ativos para organizar sua biblioteca.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Fonte Manual</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{libraryStats.manualCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Skills criadas direto no editor do WorkOS.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Ultima Atualizacao</p>
          <p className="mt-3 truncate text-lg font-semibold text-foreground">
            {libraryStats.lastUpdatedSkill?.title || "Sem registros"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {libraryStats.lastUpdatedSkill ? formatDateTime(libraryStats.lastUpdatedSkill.updated_at) : "Crie sua primeira skill"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_360px_1fr]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
            <Badge variant="secondary">{categories.length}</Badge>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("all")}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                selectedCategoryId === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span>Todas as categorias</span>
                <Badge variant="outline" className="text-[10px]">{skills.length}</Badge>
              </div>
            </button>

            {categories.map((category) => {
              const count = skills.filter((skill) => skill.category_id === category.id).length;

              return (
                <div
                  key={category.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-colors",
                    selectedCategoryId === category.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-background/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      "w-full rounded-lg text-left transition-colors",
                      selectedCategoryId === category.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{category.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {category.description || "Sem descrição para esta categoria."}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {count}
                      </Badge>
                    </div>
                  </button>

                  <div className="mt-3 flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEditCategoryDialog(category)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryPendingDelete(category);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDownloadCategoryZip(category.id);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Skills</h2>
            <Badge variant="secondary">{filteredSkills.length}</Badge>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título ou resumo"
              className="pl-9"
            />
          </div>

          {filteredSkills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma skill encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSkills.map((skill) => {
                const category = categoryMap.get(skill.category_id);
                const projectName = projectMap.get(skill.project_id || "")?.name || "Conhecimento geral";

                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkillId(skill.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-colors",
                      selectedSkill?.id === skill.id
                        ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(56,189,248,0.12)]"
                        : "border-border bg-background/30 hover:border-muted-foreground/30 hover:bg-background/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{skill.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {skill.summary || "Sem resumo"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-[10px]">{category?.name || "Sem categoria"}</Badge>
                          <Badge variant="outline" className="text-[10px]">{projectName}</Badge>
                          <Badge variant="outline" className="text-[10px]">{getSourceLabel(skill.source_type)}</Badge>
                        </div>
                      </div>
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted-foreground">
                        Atualizada em {formatDateTime(skill.updated_at)}
                      </span>
                      {selectedSkill?.id === skill.id && (
                        <span className="text-[11px] font-medium text-primary">Selecionada</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          {!selectedSkill ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Selecione uma skill para visualizar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Skill em foco</p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">{selectedSkill.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {selectedSkill.summary || "Sem resumo"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{categoryMap.get(selectedSkill.category_id)?.name || "Sem categoria"}</Badge>
                      <Badge variant="secondary">{projectMap.get(selectedSkill.project_id || "")?.name || "Conhecimento geral"}</Badge>
                      <Badge variant="outline">Fonte: {getSourceLabel(selectedSkill.source_type)}</Badge>
                      <Badge variant="outline">Atualizada em {formatDateTime(selectedSkill.updated_at)}</Badge>
                      <Badge variant="outline">Ultimo download: {formatDateTime(selectedSkill.last_downloaded_at)}</Badge>
                    </div>
                    {selectedSkill.source_type === "seed" && (
                      <Badge variant="outline" className="mt-3 gap-1">
                        <Sparkles className="h-3 w-3" />
                        Seed
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void handleDownloadSkill(selectedSkill);
                      }}
                      className="gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar .md
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditSkillDialog(selectedSkill)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger"
                      onClick={() => {
                        setSkillPendingDelete(selectedSkill);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full max-w-[320px] grid-cols-2 rounded-xl bg-background/70 p-1">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="markdown">Markdown</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-3">
                  <div className="max-h-[640px] overflow-auto rounded-2xl border border-border bg-[#0b1220] p-6">
                    <article className="prose prose-sm max-w-none prose-invert prose-headings:mb-3 prose-headings:text-white prose-p:leading-7 prose-li:leading-7 prose-strong:text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedSkill.content_md}
                      </ReactMarkdown>
                    </article>
                  </div>
                </TabsContent>

                <TabsContent value="markdown" className="mt-3">
                  <Textarea
                    readOnly
                    value={selectedSkill.content_md}
                    className="min-h-[640px] rounded-2xl border-border bg-background/80 font-mono text-xs leading-6"
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}







