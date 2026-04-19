"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Clapperboard,
  Eye,
  Film,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/dbClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CINEMATECA_SEED } from "@/features/cinemateca/seed";
import type { CinematecaMovie, CinematecaStatus, CinematecaSeedMovie } from "@/features/cinemateca/types";

type TabFilter = "all" | "want_to_watch" | "watched" | "catalog";

const POSTER_PALETTES = [
  "from-rose-900 via-stone-900 to-amber-950",
  "from-indigo-900 via-slate-900 to-emerald-950",
  "from-amber-900 via-stone-950 to-rose-950",
  "from-emerald-900 via-slate-900 to-indigo-950",
  "from-violet-900 via-stone-900 to-rose-950",
  "from-cyan-900 via-slate-900 to-violet-950",
  "from-red-900 via-stone-950 to-amber-900",
  "from-teal-900 via-slate-950 to-indigo-900",
];

function paletteFor(key: string | number) {
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return POSTER_PALETTES[hash % POSTER_PALETTES.length];
}

const POSTER_CACHE_KEY = "cinemateca-posters-v2";
type PosterCacheEntry = { url: string | null; at: number };
type PosterCache = Record<string, PosterCacheEntry>;
const POSTER_NEGATIVE_TTL_MS = 1000 * 60 * 60 * 24; // retry failed lookups after 24h

function loadPosterCache(): PosterCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(POSTER_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as PosterCache) : {};
  } catch {
    return {};
  }
}

function savePosterCache(cache: PosterCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSTER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
}

function splitGenres(genre: string | null | undefined) {
  if (!genre) return [] as string[];
  return genre.split(/[/|,]/).map((g) => g.trim()).filter(Boolean);
}

type CatalogItem =
  | { kind: "owned"; movie: CinematecaMovie }
  | { kind: "seed"; seed: CinematecaSeedMovie };

function getItemKey(item: CatalogItem) {
  return item.kind === "owned" ? `owned-${item.movie.id}` : `seed-${item.seed.seed_id}`;
}

function getPosterCacheKey(item: CatalogItem) {
  return item.kind === "owned"
    ? `movie-${item.movie.id}`
    : `seed-${item.seed.seed_id}`;
}

function getItemTitle(item: CatalogItem) {
  return item.kind === "owned" ? item.movie.title : item.seed.title;
}

function getItemYear(item: CatalogItem) {
  return item.kind === "owned" ? item.movie.year : item.seed.year;
}

function getItemGenre(item: CatalogItem) {
  return item.kind === "owned" ? item.movie.genre : item.seed.genre;
}

function getItemImdb(item: CatalogItem) {
  return item.kind === "owned" ? item.movie.imdb_rating : item.seed.imdb_rating;
}

function getItemSynopsis(item: CatalogItem) {
  return item.kind === "owned" ? item.movie.synopsis : item.seed.synopsis;
}

function getItemStatus(item: CatalogItem): CinematecaStatus | null {
  return item.kind === "owned" ? item.movie.status : null;
}

function statusBadgeStyle(status: CinematecaStatus) {
  if (status === "watched") return "bg-success-muted text-success border-success/25";
  if (status === "watching") return "bg-info-muted text-info border-info/25";
  return "bg-primary/10 text-primary border-primary/25";
}

function statusLabel(status: CinematecaStatus) {
  if (status === "watched") return "Assistido";
  if (status === "watching") return "Assistindo";
  return "Quero assistir";
}

export default function CinematecaPage() {
  const { user, loading: authLoading } = useAuth();
  const [movies, setMovies] = useState<CinematecaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>("todos");
  const [detailItem, setDetailItem] = useState<CatalogItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newPoster, setNewPoster] = useState("");
  const [newImdb, setNewImdb] = useState("");

  const [resolvedPosters, setResolvedPosters] = useState<Record<string, string>>({});
  const posterFetchStarted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMovies([]);
      setLoading(false);
      return;
    }
    void loadMovies();
  }, [authLoading, user]);

  async function loadMovies() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await db
        .from("cinemateca_movies")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setMovies((data || []) as CinematecaMovie[]);
    } catch (error) {
      console.error("Erro ao carregar cinemateca", error);
      toast.error("Nao foi possivel carregar sua cinemateca.");
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }

  const ownedSeedIds = useMemo(() => {
    const set = new Set<number>();
    movies.forEach((movie) => {
      if (movie.seed_id != null) set.add(movie.seed_id);
    });
    return set;
  }, [movies]);

  const catalogOnly = useMemo(
    () => CINEMATECA_SEED.filter((seed) => !ownedSeedIds.has(seed.seed_id)),
    [ownedSeedIds],
  );

  const allItems: CatalogItem[] = useMemo(() => {
    const owned: CatalogItem[] = movies.map((movie) => ({ kind: "owned", movie }));
    const seeds: CatalogItem[] = catalogOnly.map((seed) => ({ kind: "seed", seed }));
    return [...owned, ...seeds];
  }, [movies, catalogOnly]);

  useEffect(() => {
    const cache = loadPosterCache();
    const now = Date.now();
    const hydrated: Record<string, string> = {};
    for (const item of allItems) {
      const key = getPosterCacheKey(item);
      const entry = cache[key];
      if (entry?.url) hydrated[key] = entry.url;
    }
    setResolvedPosters((prev) => ({ ...hydrated, ...prev }));

    const pending: CatalogItem[] = [];
    for (const item of allItems) {
      const key = getPosterCacheKey(item);
      if (item.kind === "owned" && item.movie.poster_url) continue;
      if (hydrated[key]) continue;
      const entry = cache[key];
      if (entry && entry.url === null && now - entry.at < POSTER_NEGATIVE_TTL_MS) continue;
      if (posterFetchStarted.current.has(key)) continue;
      pending.push(item);
    }
    if (!pending.length) return;

    let cancelled = false;
    const queue = [...pending];
    pending.forEach((item) => posterFetchStarted.current.add(getPosterCacheKey(item)));

    const workers = Array.from({ length: 2 }, async () => {
      while (queue.length && !cancelled) {
        const item = queue.shift();
        if (!item) break;
        const key = getPosterCacheKey(item);
        const title = getItemTitle(item);
        const year = getItemYear(item);
        const params = new URLSearchParams({ title });
        if (year) params.set("year", String(year));
        try {
          const res = await fetch(`/api/cinemateca/poster?${params.toString()}`, { cache: "no-store" });
          const data = (await res.json().catch(() => null)) as { url: string | null } | null;
          const url = data?.url || null;
          const current = loadPosterCache();
          current[key] = { url, at: Date.now() };
          savePosterCache(current);
          if (cancelled) return;
          if (url) {
            setResolvedPosters((prev) => ({ ...prev, [key]: url }));
            if (item.kind === "owned" && user) {
              const id = item.movie.id;
              void db.from("cinemateca_movies").update({ poster_url: url }).eq("id", id);
              setMovies((prev) => prev.map((m) => (m.id === id ? { ...m, poster_url: url } : m)));
            }
          }
        } catch {
          // swallow, keep fallback gradient
        }
      }
    });

    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [allItems, user]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const g = getItemGenre(item);
      splitGenres(g).forEach((part) => set.add(part));
    });
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (tab === "want_to_watch" && !(item.kind === "owned" && item.movie.status === "want_to_watch")) return false;
      if (tab === "watched" && !(item.kind === "owned" && item.movie.status === "watched")) return false;
      if (tab === "catalog" && item.kind !== "seed") return false;

      if (genre !== "todos") {
        const parts = splitGenres(getItemGenre(item));
        if (!parts.includes(genre)) return false;
      }

      if (normalized) {
        const title = getItemTitle(item).toLowerCase();
        const g = (getItemGenre(item) || "").toLowerCase();
        if (!title.includes(normalized) && !g.includes(normalized)) return false;
      }

      return true;
    });
  }, [allItems, tab, genre, search]);

  const stats = useMemo(() => {
    const watched = movies.filter((m) => m.status === "watched").length;
    const wantToWatch = movies.filter((m) => m.status === "want_to_watch").length;
    const rated = movies.filter((m) => m.user_rating != null);
    const avg = rated.length
      ? (rated.reduce((acc, m) => acc + (m.user_rating || 0), 0) / rated.length).toFixed(1)
      : null;
    return {
      total: movies.length,
      watched,
      wantToWatch,
      ratedCount: rated.length,
      avg,
    };
  }, [movies]);

  async function upsertFromSeed(seed: CinematecaSeedMovie, status: CinematecaStatus) {
    if (!user) return null;
    const payload = {
      user_id: user.id,
      seed_id: seed.seed_id,
      title: seed.title,
      year: seed.year,
      genre: seed.genre,
      imdb_rating: seed.imdb_rating,
      synopsis: seed.synopsis,
      status,
      watched_at: status === "watched" ? new Date().toISOString() : null,
    };
    const { data, error } = await db
      .from("cinemateca_movies")
      .upsert(payload, { onConflict: "user_id,seed_id" })
      .select()
      .maybeSingle();
    if (error) {
      toast.error("Nao foi possivel salvar o filme.");
      return null;
    }
    await loadMovies();
    return data as CinematecaMovie | null;
  }

  async function quickAddSeed(seed: CinematecaSeedMovie, status: CinematecaStatus) {
    const saved = await upsertFromSeed(seed, status);
    if (saved) {
      toast.success(status === "watched" ? "Marcado como assistido" : "Adicionado a lista");
    }
  }

  async function updateMovie(id: string, patch: Partial<CinematecaMovie>) {
    if (!user) return;
    const { error } = await db.from("cinemateca_movies").update(patch).eq("id", id);
    if (error) {
      toast.error("Nao foi possivel atualizar.");
      return;
    }
    await loadMovies();
    setDetailItem((current) => {
      if (!current || current.kind !== "owned" || current.movie.id !== id) return current;
      return { kind: "owned", movie: { ...current.movie, ...patch } as CinematecaMovie };
    });
  }

  async function removeMovie(id: string) {
    if (!user) return;
    const { error } = await db.from("cinemateca_movies").delete().eq("id", id);
    if (error) {
      toast.error("Nao foi possivel remover.");
      return;
    }
    toast.success("Filme removido");
    setDetailItem(null);
    await loadMovies();
  }

  async function createCustom() {
    if (!user) return;
    const title = newTitle.trim();
    if (!title) {
      toast.error("Informe o titulo do filme.");
      return;
    }
    const payload = {
      user_id: user.id,
      seed_id: null,
      title,
      year: newYear ? parseInt(newYear, 10) || null : null,
      genre: newGenre.trim() || null,
      imdb_rating: newImdb.trim() || null,
      synopsis: newSynopsis.trim() || null,
      poster_url: newPoster.trim() || null,
      status: "want_to_watch" as CinematecaStatus,
    };
    const { error } = await db.from("cinemateca_movies").insert(payload);
    if (error) {
      toast.error("Nao foi possivel adicionar o filme.");
      return;
    }
    toast.success("Filme adicionado!");
    setAddOpen(false);
    setNewTitle("");
    setNewYear("");
    setNewGenre("");
    setNewSynopsis("");
    setNewPoster("");
    setNewImdb("");
    await loadMovies();
  }

  if (authLoading || loading) {
    return <LoadingState message="Carregando sua cinemateca..." />;
  }

  if (!user) {
    return <EmptyState icon={Clapperboard} title="Sessao expirada" description="Entre novamente para ver sua cinemateca." />;
  }

  const detailOwned = detailItem?.kind === "owned" ? detailItem.movie : null;
  const detailSeed = detailItem?.kind === "seed" ? detailItem.seed : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Cinemateca"
        description="Sua prateleira pessoal: acompanhe o que ja viu, organize o que quer ver e de nota aos favoritos."
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Adicionar filme
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Novo filme</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Titulo</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Oppenheimer" className="bg-background border-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Ano</Label>
                    <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="2024" inputMode="numeric" className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nota IMDb</Label>
                    <Input value={newImdb} onChange={(e) => setNewImdb(e.target.value)} placeholder="7.8" className="bg-background border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Genero</Label>
                  <Input value={newGenre} onChange={(e) => setNewGenre(e.target.value)} placeholder="Drama / Suspense" className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">URL da capa (opcional)</Label>
                  <Input value={newPoster} onChange={(e) => setNewPoster(e.target.value)} placeholder="https://..." className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Sinopse</Label>
                  <Textarea value={newSynopsis} onChange={(e) => setNewSynopsis(e.target.value)} rows={3} className="bg-background border-border" />
                </div>
                <Button onClick={createCustom} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Adicionar a prateleira
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Film className="h-4 w-4 text-primary" />
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow">Coleção</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">filmes na sua prateleira</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4 text-success" />
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow">Assistidos</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.watched}</p>
          <p className="mt-1 text-xs text-muted-foreground">ja passaram pela sua TV</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookmarkPlus className="h-4 w-4 text-primary" />
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow">Quero assistir</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.wantToWatch}</p>
          <p className="mt-1 text-xs text-muted-foreground">esperando na fila</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star className="h-4 w-4 text-warning" />
            <p className="text-eyebrow font-semibold uppercase tracking-eyebrow">Sua media</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-foreground">{stats.avg || "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.ratedCount} filme(s) avaliado(s)</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/95 p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "all", label: "Todos" },
                { value: "want_to_watch", label: "Quero assistir" },
                { value: "watched", label: "Assistidos" },
                { value: "catalog", label: "Catalogo" },
              ] as Array<{ value: TabFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTab(opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === opt.value
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar titulo ou genero"
                className="h-10 rounded-2xl border-border bg-background/60 pl-10 sm:w-[260px]"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-eyebrow transition-colors",
                genre === g
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {g === "todos" ? "Todos os generos" : g}
            </button>
          ))}
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Nada encontrado"
          description="Ajuste a busca, troque de aba ou adicione um filme novo para ver a prateleira preencher."
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredItems.map((item) => (
            <PosterCard
              key={getItemKey(item)}
              item={item}
              resolvedPoster={resolvedPosters[getPosterCacheKey(item)] || null}
              onOpen={() => setDetailItem(item)}
              onQuickAdd={quickAddSeed}
            />
          ))}
        </section>
      )}

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          {detailItem ? (
            <DetailContent
              item={detailItem}
              onUpdate={updateMovie}
              onRemove={removeMovie}
              onAdd={upsertFromSeed}
              onClose={() => setDetailItem(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PosterCard({
  item,
  resolvedPoster,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItem;
  resolvedPoster: string | null;
  onOpen: () => void;
  onQuickAdd: (seed: CinematecaSeedMovie, status: CinematecaStatus) => Promise<void>;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const title = getItemTitle(item);
  const year = getItemYear(item);
  const genre = getItemGenre(item);
  const imdb = getItemImdb(item);
  const status = getItemStatus(item);
  const userRating = item.kind === "owned" ? item.movie.user_rating : null;
  const ownedPoster = item.kind === "owned" ? item.movie.poster_url : null;
  const posterUrl = imgFailed ? null : ownedPoster || resolvedPoster;
  const palette = paletteFor(item.kind === "owned" ? item.movie.id : item.seed.seed_id);

  return (
    <div className="group flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border/70 bg-stone-950 text-left shadow-[0_20px_50px_-32px_rgba(0,0,0,0.8)] transition-transform hover:-translate-y-0.5 hover:border-primary/40"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br", palette)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:3px_3px]" />
            <div className="relative flex h-full flex-col justify-between p-4">
              <Clapperboard className="h-6 w-6 text-white/40" />
              <div className="space-y-1.5">
                <p className="font-serif text-lg font-semibold leading-tight text-white line-clamp-3">{title}</p>
                <p className="text-caption uppercase tracking-loose text-white/60">
                  {year ? `${year}` : ""}{year && genre ? " · " : ""}{genre || ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {status ? (
          <span className={cn("absolute left-2 top-2 rounded-full border px-2 py-0.5 text-caption font-semibold backdrop-blur", statusBadgeStyle(status))}>
            {statusLabel(status)}
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-caption font-semibold text-white/80 backdrop-blur">
            Catalogo
          </span>
        )}

        {userRating != null ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-warning/30 bg-black/55 px-2 py-0.5 text-caption font-semibold text-warning backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> {userRating}
          </span>
        ) : imdb && imdb !== "N/D" ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-caption font-semibold text-white/85 backdrop-blur">
            <Star className="h-3 w-3" /> {imdb}
          </span>
        ) : null}
      </button>

      <div className="px-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="text-eyebrow text-muted-foreground">
          {year || "—"}{genre ? ` · ${splitGenres(genre)[0]}` : ""}
        </p>

        {item.kind === "seed" ? (
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onQuickAdd(item.seed, "want_to_watch");
              }}
              className="flex-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-eyebrow font-medium text-primary hover:bg-primary/15"
            >
              + Lista
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onQuickAdd(item.seed, "watched");
              }}
              className="flex-1 rounded-lg border border-success/25 bg-success-muted px-2 py-1 text-eyebrow font-medium text-success hover:bg-success/20"
            >
              <Check className="inline h-3 w-3" /> Vi
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailContent({
  item,
  onUpdate,
  onRemove,
  onAdd,
  onClose,
}: {
  item: CatalogItem;
  onUpdate: (id: string, patch: Partial<CinematecaMovie>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAdd: (seed: CinematecaSeedMovie, status: CinematecaStatus) => Promise<CinematecaMovie | null>;
  onClose: () => void;
}) {
  const title = getItemTitle(item);
  const year = getItemYear(item);
  const genre = getItemGenre(item);
  const imdb = getItemImdb(item);
  const synopsis = getItemSynopsis(item);
  const owned = item.kind === "owned" ? item.movie : null;
  const [notes, setNotes] = useState(owned?.notes || "");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    setNotes(owned?.notes || "");
    setNotesDirty(false);
  }, [owned?.id]);

  async function setStatus(status: CinematecaStatus) {
    if (owned) {
      await onUpdate(owned.id, {
        status,
        watched_at: status === "watched" ? new Date().toISOString() : null,
      });
    } else if (item.kind === "seed") {
      await onAdd(item.seed, status);
      onClose();
    }
  }

  async function setRating(rating: number) {
    if (!owned) return;
    await onUpdate(owned.id, { user_rating: rating, status: "watched", watched_at: owned.watched_at || new Date().toISOString() });
  }

  async function clearRating() {
    if (!owned) return;
    await onUpdate(owned.id, { user_rating: null });
  }

  async function saveNotes() {
    if (!owned) return;
    await onUpdate(owned.id, { notes: notes.trim() || null });
    setNotesDirty(false);
    toast.success("Notas salvas");
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-10 text-xl font-semibold text-foreground">{title}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {year ? <span className="rounded-full border border-border/70 px-2 py-0.5">{year}</span> : null}
          {splitGenres(genre).map((g) => (
            <span key={g} className="rounded-full border border-border/70 px-2 py-0.5">{g}</span>
          ))}
          {imdb && imdb !== "N/D" ? (
            <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning-muted px-2 py-0.5 text-warning">
              <Star className="h-3 w-3" /> IMDb {imdb}
            </span>
          ) : null}
        </div>

        {synopsis ? (
          <p className="text-sm leading-relaxed text-foreground/90">{synopsis}</p>
        ) : null}

        <div className="rounded-2xl border border-border bg-background/50 p-4 space-y-4">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-label text-muted-foreground">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: "want_to_watch" as const, label: "Quero assistir", icon: BookmarkPlus },
                  { value: "watching" as const, label: "Assistindo", icon: Eye },
                  { value: "watched" as const, label: "Assisti", icon: Check },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const active = owned?.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? statusBadgeStyle(opt.value)
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {owned ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-eyebrow font-semibold uppercase tracking-label text-muted-foreground">Sua nota</p>
                {owned.user_rating != null ? (
                  <button type="button" onClick={clearRating} className="text-eyebrow text-muted-foreground hover:text-danger">
                    Limpar
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, idx) => idx + 1).map((n) => {
                  const active = owned.user_rating === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={cn(
                        "h-9 w-9 rounded-lg border text-sm font-semibold transition-all",
                        active
                          ? "border-warning bg-warning-muted text-warning scale-105"
                          : "border-border bg-background text-muted-foreground hover:border-warning/40 hover:text-warning",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {owned ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-eyebrow font-semibold uppercase tracking-label text-muted-foreground">Anotacoes</p>
                {notesDirty ? (
                  <button type="button" onClick={saveNotes} className="text-eyebrow font-medium text-primary hover:underline">
                    Salvar
                  </button>
                ) : null}
              </div>
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesDirty(true);
                }}
                rows={3}
                placeholder="O que achou? Algum momento marcante?"
                className="mt-2 bg-background border-border"
              />
            </div>
          ) : null}
        </div>

        {owned ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => void onRemove(owned.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:border-danger/40 hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover da prateleira
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Fechar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
