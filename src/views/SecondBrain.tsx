import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive,
  ArchiveRestore,
  BrainCircuit,
  Link2,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteConfirmDialog } from "@/components/system/delete-confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getUniqueSlug } from "@/lib/markdown";
import {
  buildCapturePayload,
  buildSecondBrainGraphData,
  canCreateManualLink,
  computeWikiLinkSyncPlan,
  extractWikiLinkSlugs,
  filterSecondBrainNotes,
  parseTagsInput,
  rankConnectionSuggestions,
  type SecondBrainStatusFilter,
} from "@/lib/secondBrain";
import {
  GENERAL_PROJECT_VALUE,
  projectIdFromSelectValue,
  projectSelectValue,
} from "@/config/constants";
import type { Project, SecondBrainLink, SecondBrainNote } from "@/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphNode = {
  id: string;
  title: string;
  status: "inbox" | "note" | "archived";
  tags: string[];
};

type GraphLink = {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  link_type: "manual" | "wikilink";
};

const STATUS_LABEL: Record<SecondBrainNote["status"], string> = {
  inbox: "Inbox",
  note: "Note",
  archived: "Archived",
};

const STATUS_BADGE_CLASS: Record<SecondBrainNote["status"], string> = {
  inbox: "bg-warning/15 text-warning border-warning/20",
  note: "bg-info/15 text-info border-info/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const GRAPH_NODE_COLOR: Record<SecondBrainNote["status"], string> = {
  inbox: "#f59e0b",
  note: "#3b82f6",
  archived: "#6b7280",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTagsInput(tags: string[]) {
  return tags.join(", ");
}

function getStatusDescription(status: SecondBrainNote["status"]) {
  if (status === "inbox") return "Capturada e aguardando organizacao.";
  if (status === "archived") return "Guardada no histórico da base.";
  return "Nota ativa e pronta para conexões.";
}

export default function SecondBrainPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  const [notes, setNotes] = useState<SecondBrainNote[]>([]);
  const [links, setLinks] = useState<SecondBrainLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SecondBrainStatusFilter>("active");
  const [tagFilter, setTagFilter] = useState("");

  const [captureContent, setCaptureContent] = useState("");
  const [captureSourceUrl, setCaptureSourceUrl] = useState("");
  const [captureTagsInput, setCaptureTagsInput] = useState("");
  const [captureProjectValue, setCaptureProjectValue] = useState(GENERAL_PROJECT_VALUE);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorStatus, setEditorStatus] = useState<SecondBrainNote["status"]>("note");
  const [editorSourceUrl, setEditorSourceUrl] = useState("");
  const [editorTagsInput, setEditorTagsInput] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorProjectValue, setEditorProjectValue] = useState(GENERAL_PROJECT_VALUE);
  const [manualTargetId, setManualTargetId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [graphWidth, setGraphWidth] = useState(640);

  useEffect(() => {
    if (!graphContainerRef.current) return;

    const container = graphContainerRef.current;
    const updateWidth = () => {
      setGraphWidth(Math.max(420, Math.floor(container.clientWidth)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    try {
      const [notesRes, linksRes, projectsRes] = await Promise.all([
        db.from("second_brain_notes").select("*").order("updated_at", { ascending: false }),
        db.from("second_brain_links").select("*").order("created_at", { ascending: false }),
        db.from("projects").select("*").order("name"),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (linksRes.error) throw linksRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setNotes((notesRes.data || []) as unknown as SecondBrainNote[]);
      setLinks((linksRes.data || []) as unknown as SecondBrainLink[]);
      setProjects((projectsRes.data || []) as unknown as Project[]);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void loadData();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user]);

  useEffect(() => {
    const requestedStatus = searchParams?.get("status");
    if (requestedStatus === "all" || requestedStatus === "active" || requestedStatus === "inbox" || requestedStatus === "note" || requestedStatus === "archived") {
      setStatusFilter(requestedStatus);
    }
  }, [searchParams]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || null,
    [notes, selectedNoteId],
  );

  const noteMap = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const filteredNotes = useMemo(
    () => filterSecondBrainNotes(notes, search, statusFilter, tagFilter),
    [notes, search, statusFilter, tagFilter],
  );

  const secondBrainStats = useMemo(() => {
    const inboxCount = notes.filter((note) => note.status === "inbox").length;
    const activeCount = notes.filter((note) => note.status === "note").length;
    const archivedCount = notes.filter((note) => note.status === "archived").length;
    const topTags = [...new Map(
      notes
        .flatMap((note) => note.tags)
        .map((tag) => [tag, notes.filter((note) => note.tags.includes(tag)).length] as const),
    ).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      inboxCount,
      activeCount,
      archivedCount,
      topTags,
    };
  }, [notes]);

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    const isCurrentVisible = selectedNoteId ? filteredNotes.some((note) => note.id === selectedNoteId) : false;
    if (!isCurrentVisible) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      setEditorTitle("");
      setEditorStatus("note");
      setEditorSourceUrl("");
      setEditorTagsInput("");
      setEditorContent("");
      setEditorProjectValue(GENERAL_PROJECT_VALUE);
      return;
    }

    setEditorTitle(selectedNote.title);
    setEditorStatus(selectedNote.status);
    setEditorSourceUrl(selectedNote.source_url || "");
    setEditorTagsInput(buildTagsInput(selectedNote.tags));
    setEditorContent(selectedNote.content_md);
    setEditorProjectValue(projectSelectValue(selectedNote.project_id));
  }, [selectedNote]);

  const graphData = useMemo(
    () => buildSecondBrainGraphData(filteredNotes, links),
    [filteredNotes, links],
  );

  const outgoingLinks = useMemo(
    () => links.filter((link) => link.source_note_id === selectedNote?.id),
    [links, selectedNote?.id],
  );

  const suggestions = useMemo(
    () => rankConnectionSuggestions(selectedNote, notes, links, 5),
    [selectedNote, notes, links],
  );

  const manualTargets = useMemo(() => {
    if (!selectedNote) return [];
    return notes
      .filter((note) => note.id !== selectedNote.id)
      .filter((note) => note.status !== "archived")
      .filter((note) => canCreateManualLink(selectedNote.id, note.id, links).ok);
  }, [links, notes, selectedNote]);

  async function syncWikilinks(noteId: string, contentMd: string) {
    if (!user) return;

    const parsedSlugs = extractWikiLinkSlugs(contentMd);
    const existingTargets = links
      .filter((link) => link.source_note_id === noteId && link.link_type === "wikilink")
      .map((link) => link.target_note_id);

    let desiredTargets: string[] = [];

    if (parsedSlugs.length > 0) {
      const { data, error } = await db
        .from("second_brain_notes")
        .select("id,slug")
        .in("slug", parsedSlugs);

      if (error) throw error;

      desiredTargets = (data || [])
        .map((row) => row.id)
        .filter((targetId) => targetId !== noteId);
    }

    const { toCreate, toDelete } = computeWikiLinkSyncPlan(existingTargets, desiredTargets);

    if (toDelete.length > 0) {
      const { error } = await db
        .from("second_brain_links")
        .delete()
        .eq("source_note_id", noteId)
        .eq("link_type", "wikilink")
        .in("target_note_id", toDelete);

      if (error) throw error;
    }

    if (toCreate.length > 0) {
      const rows = toCreate.map((targetId) => ({
        user_id: user.id,
        source_note_id: noteId,
        target_note_id: targetId,
        link_type: "wikilink" as const,
      }));

      const { error } = await db.from("second_brain_links").insert(rows);
      if (error && error.code !== "23505") throw error;
    }
  }

  async function handleCaptureNote() {
    if (!user) return;
    if (!captureContent.trim()) {
      toast.error("Digite algo para capturar");
      return;
    }

    setMutating(true);

    try {
      const payload = buildCapturePayload({
        content: captureContent,
        sourceUrl: captureSourceUrl,
        tagsInput: captureTagsInput,
        existingSlugs: notes.map((note) => note.slug),
      });

      const { data, error } = await db
        .from("second_brain_notes")
        .insert({
          ...payload,
          user_id: user.id,
          project_id: projectIdFromSelectValue(captureProjectValue),
        })
        .select("*")
        .single();

      if (error) throw error;

      await syncWikilinks(data.id, payload.content_md);
      toast.success("Nota capturada no inbox");

      setCaptureContent("");
      setCaptureSourceUrl("");
      setCaptureTagsInput("");
      setCaptureProjectValue(GENERAL_PROJECT_VALUE);
      await loadData();
      setSelectedNoteId(data.id);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao capturar nota");
    } finally {
      setMutating(false);
    }
  }

  async function handleSaveNote() {
    if (!selectedNote || !user) return;
    if (!editorTitle.trim()) {
      toast.error("Título e obrigatório");
      return;
    }

    setMutating(true);

    try {
      const slug = getUniqueSlug(
        editorTitle.trim(),
        notes.filter((note) => note.id !== selectedNote.id).map((note) => note.slug),
      );

      const { error } = await db
        .from("second_brain_notes")
        .update({
          title: editorTitle.trim(),
          slug,
          status: editorStatus,
          project_id: projectIdFromSelectValue(editorProjectValue),
          source_url: editorSourceUrl.trim() || null,
          tags: parseTagsInput(editorTagsInput),
          content_md: editorContent,
        })
        .eq("id", selectedNote.id);

      if (error) throw error;

      await syncWikilinks(selectedNote.id, editorContent);
      toast.success("Nota salva");
      await loadData();
      setSelectedNoteId(selectedNote.id);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar nota");
    } finally {
      setMutating(false);
    }
  }

  async function handleDeleteNote() {
    if (!selectedNote) return;

    setMutating(true);

    try {
      const { error } = await db.from("second_brain_notes").delete().eq("id", selectedNote.id);
      if (error) throw error;

      toast.success("Nota excluida");
      await loadData();
      setSelectedNoteId(null);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao excluir nota");
    } finally {
      setMutating(false);
    }
  }

  async function handleToggleArchive() {
    if (!selectedNote) return;
    const nextStatus = selectedNote.status === "archived" ? "note" : "archived";

    setMutating(true);

    try {
      const { error } = await db
        .from("second_brain_notes")
        .update({ status: nextStatus })
        .eq("id", selectedNote.id);

      if (error) throw error;

      toast.success(nextStatus === "archived" ? "Nota arquivada" : "Nota reativada");
      await loadData();
      setSelectedNoteId(selectedNote.id);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao alterar status");
    } finally {
      setMutating(false);
    }
  }

  async function handleCreateManualLink(targetNoteId: string) {
    if (!selectedNote || !user) return;

    const validation = canCreateManualLink(selectedNote.id, targetNoteId, links);
    if (!validation.ok) {
      if (validation.reason === "self_link") {
        toast.error("Uma nota não pode linkar para ela mesma");
      } else if (validation.reason === "duplicate") {
        toast.error("Essa conexão já existe");
      } else {
        toast.error("Selecione uma nota valida");
      }
      return;
    }

    setMutating(true);

    try {
      const { error } = await db.from("second_brain_links").insert({
        user_id: user.id,
        source_note_id: selectedNote.id,
        target_note_id: targetNoteId,
        link_type: "manual",
      });

      if (error) throw error;

      toast.success("Conexão criada");
      setManualTargetId("");
      await loadData();
      setSelectedNoteId(selectedNote.id);
    } catch (error) {
      toast.error((error as Error).message || "Falha ao criar conexão");
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemLabel={`a nota "${selectedNote?.title || ""}"`}
        onConfirm={async () => {
          await handleDeleteNote();
          setDeleteDialogOpen(false);
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Second Brain</h1>
          <p className="text-sm text-muted-foreground">
            Capture rápido, organize melhor e conecte notas em uma base viva de conhecimento.
          </p>
        </div>

        <Button variant="outline" className="gap-2" onClick={() => void loadData()}>
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Inbox</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{secondBrainStats.inboxCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Notas capturadas aguardando processamento.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Ativas</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{secondBrainStats.activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Notas prontas para consulta e conexão.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Arquivadas</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{secondBrainStats.archivedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Histórico preservado fora do fluxo principal.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Tags em alta</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {secondBrainStats.topTags.length === 0 ? (
              <span className="text-sm text-muted-foreground">Sem tags ainda</span>
            ) : (
              secondBrainStats.topTags.map(([tag, count]) => (
                <Badge key={tag} variant="secondary">{tag} ({count})</Badge>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Temas mais recorrentes na base atual.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Captura rápida</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Jogue primeiro no Inbox</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cole ideias, trechos, links ou insights sem se preocupar em organizar tudo agora.
            </p>
          </div>
          <Badge variant="outline">Nova nota vai para Inbox</Badge>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea
              value={captureContent}
              onChange={(event) => setCaptureContent(event.target.value)}
              placeholder="Cole trecho, ideia, insight..."
              className="min-h-24"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>URL de origem</Label>
              <Input
                value={captureSourceUrl}
                onChange={(event) => setCaptureSourceUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (separadas por virgula)</Label>
              <Input
                value={captureTagsInput}
                onChange={(event) => setCaptureTagsInput(event.target.value)}
                placeholder="pkm, research, produto"
              />
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={captureProjectValue} onValueChange={setCaptureProjectValue}>
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

          <Button onClick={() => void handleCaptureNote()} disabled={mutating} className="gap-2">
            <Plus className="h-4 w-4" />
            Capturar no Inbox
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Notas</h2>
            <Badge variant="secondary">{filteredNotes.length}</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Buscar por título, conteúdo, tags"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SecondBrainStatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtro de status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativas (Inbox + Note)</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="inbox">Inbox</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Filtrar por tags"
            />
          </div>

          <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
            {filteredNotes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Nenhuma nota encontrada.
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    selectedNoteId === note.id
                      ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(56,189,248,0.12)]"
                      : "border-border bg-background/30 hover:border-muted-foreground/40 hover:bg-background/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{note.title}</p>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[note.status]}>
                      {STATUS_LABEL[note.status]}
                    </Badge>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {note.content_md.slice(0, 120) || "Sem conteúdo ainda."}
                  </p>

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Atualizada em {formatDateTime(note.updated_at)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {projectMap.get(note.project_id || "")?.name || "Conhecimento geral"}
                    </Badge>
                    {note.tags.slice(0, 3).map((tag) => (
                      <Badge key={`${note.id}-${tag}`} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Teia de conhecimento</h2>
                <p className="text-sm text-muted-foreground">
                  Esta área agora e o centro visual da tela. Explore relacoes e abra notas direto pelo grafo.
                </p>
              </div>
              <Badge variant="secondary">{graphData.nodes.length} nos</Badge>
            </div>

            {selectedNote && (
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centro atual</p>
                <p className="mt-2 text-lg font-medium text-foreground">{selectedNote.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {outgoingLinks.length} conexão(oes) saindo desta nota e {suggestions.length} sugestao(oes) relacionadas.
                </p>
              </div>
            )}

            <div ref={graphContainerRef} className="rounded-2xl border border-border bg-background p-2">
              {graphData.nodes.length === 0 ? (
                <div className="flex h-[520px] items-center justify-center text-center text-sm text-muted-foreground">
                  Sem notas no filtro atual para montar o grafo.
                </div>
              ) : (
                <ForceGraph2D
                  width={graphWidth}
                  height={520}
                  graphData={{
                    nodes: graphData.nodes,
                    links: graphData.links as GraphLink[],
                  }}
                  nodeRelSize={5}
                  cooldownTicks={80}
                  linkDirectionalArrowLength={5}
                  linkDirectionalArrowRelPos={1}
                  linkCurvature={0.15}
                  nodeColor={(node) => GRAPH_NODE_COLOR[node.status] || "#8b5cf6"}
                  linkColor={(link) => (link.link_type === "manual" ? "#22c55e" : "#64748b")}
                  nodeLabel={(node) => `${node.title} (${STATUS_LABEL[node.status]})`}
                  onNodeClick={(node: any) => setSelectedNoteId(node?.id ? String(node.id) : null)}
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Clique em um no para abrir a nota. Links verdes sao manuais, cinza sao wikilinks.
            </p>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            {!selectedNote ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center gap-2 text-center">
                <BrainCircuit className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selecione uma nota para editar e conectar.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Nota em foco</p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">{selectedNote.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{getStatusDescription(selectedNote.status)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className={STATUS_BADGE_CLASS[selectedNote.status]}>
                          {STATUS_LABEL[selectedNote.status]}
                        </Badge>
                        <Badge variant="secondary">
                          {projectMap.get(selectedNote.project_id || "")?.name || "Conhecimento geral"}
                        </Badge>
                        <Badge variant="outline">Atualizada em {formatDateTime(selectedNote.updated_at)}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleSaveNote()} disabled={mutating} className="gap-2">
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                      <Button variant="outline" onClick={() => void handleToggleArchive()} disabled={mutating} className="gap-2">
                        {selectedNote.status === "archived" ? (
                          <>
                            <ArchiveRestore className="h-4 w-4" />
                            Reativar
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4" />
                            Arquivar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 text-danger hover:text-danger"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={mutating}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_240px]">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editorStatus} onValueChange={(value) => setEditorStatus(value as SecondBrainNote["status"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbox">Inbox</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={editorProjectValue} onValueChange={setEditorProjectValue}>
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

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>URL de origem</Label>
                    <Input
                      value={editorSourceUrl}
                      onChange={(event) => setEditorSourceUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <Input
                      value={editorTagsInput}
                      onChange={(event) => setEditorTagsInput(event.target.value)}
                      placeholder="pkm, processo, insight"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Markdown</Label>
                  <Textarea
                    value={editorContent}
                    onChange={(event) => setEditorContent(event.target.value)}
                    className="min-h-[280px] rounded-2xl border-border bg-background/70 font-mono text-xs leading-6"
                    placeholder="Use [[wikilinks]] para conectar notas"
                  />
                </div>

                <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label>Conexão manual</Label>
                    <Select value={manualTargetId} onValueChange={setManualTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar nota para conectar" />
                      </SelectTrigger>
                      <SelectContent>
                        {manualTargets.map((note) => (
                          <SelectItem key={note.id} value={note.id}>
                            {note.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={!manualTargetId || mutating}
                      onClick={() => void handleCreateManualLink(manualTargetId)}
                    >
                      <Link2 className="h-4 w-4" />
                      Conectar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conexões atuais</p>
                    {outgoingLinks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem conexões saindo desta nota.</p>
                    ) : (
                      <div className="space-y-2">
                        {outgoingLinks.map((link) => (
                          <div key={link.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
                            <button
                              type="button"
                              className="truncate text-xs text-foreground hover:text-primary"
                              onClick={() => setSelectedNoteId(link.target_note_id)}
                            >
                              {noteMap.get(link.target_note_id)?.title || "Nota removida"}
                            </button>
                            <Badge variant="outline" className="text-[10px]">
                              {link.link_type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestoes por tags</p>
                    {suggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem sugestoes no momento.</p>
                    ) : (
                      <div className="space-y-2">
                        {suggestions.map((item) => (
                          <div key={item.note.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{item.note.title}</p>
                              <p className="text-[10px] text-muted-foreground">{item.sharedTagsCount} tag(s) em comum</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              disabled={mutating}
                              onClick={() => void handleCreateManualLink(item.note.id)}
                            >
                              Conectar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-[#0b1220] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                  <article className="prose prose-sm max-w-none overflow-auto prose-invert prose-headings:text-white prose-p:leading-7 prose-li:leading-7 prose-strong:text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editorContent || "_Sem conteúdo_"}</ReactMarkdown>
                  </article>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}




