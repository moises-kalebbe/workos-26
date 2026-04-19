import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";

async function tryTMDB(title: string, year: number | null, signal: AbortSignal) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ api_key: apiKey, query: title, language: "pt-BR" });
  if (year) params.set("year", String(year));

  const url = `${TMDB_BASE}/search/movie?${params.toString()}`;
  const res = await fetch(url, { signal, headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    results?: Array<{ poster_path?: string | null }>;
  } | null;

  const poster = data?.results?.[0]?.poster_path;
  if (!poster) return null;
  return `${TMDB_IMG_BASE}${poster}`;
}

async function tryITunes(title: string, year: number | null, signal: AbortSignal) {
  const countryCodes = ["us", "br", "gb"];
  for (const country of countryCodes) {
    const term = year ? `${title} ${year}` : title;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=movie&limit=3&country=${country}`;
    try {
      const response = await fetch(url, { signal, headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) continue;
      const data = (await response.json().catch(() => null)) as {
        results?: Array<{ artworkUrl100?: string; artworkUrl60?: string }>;
      } | null;
      const raw = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
      if (raw) return raw.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, "/600x600bb.$1");
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = (searchParams.get("title") || "").trim();
    const yearRaw = searchParams.get("year");
    const year = yearRaw ? parseInt(yearRaw, 10) || null : null;

    if (!title) {
      return NextResponse.json({ url: null, source: null });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const tmdbResult = await tryTMDB(title, year, controller.signal).catch(() => null);
      if (tmdbResult) {
        return NextResponse.json({ url: tmdbResult, source: "tmdb" });
      }

      const itunesResult = await tryITunes(title, year, controller.signal).catch(() => null);
      if (itunesResult) {
        return NextResponse.json({ url: itunesResult, source: "itunes" });
      }

      return NextResponse.json({ url: null, source: null });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return NextResponse.json(
      { url: null, source: null, error: error instanceof Error ? error.message : "unknown" },
      { status: 200 },
    );
  }
}
