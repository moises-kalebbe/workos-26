import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const IMAGE_EXT_RE = /\.(jpe?g|png|webp)(?:\?|$)/i;

function isLikelyPoster(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/gstatic\.com|google\.com\/logos|googleusercontent\.com\/images\/branding/i.test(url)) return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  return IMAGE_EXT_RE.test(url);
}

async function tryGoogleImages(query: string, signal: AbortSignal) {
  const url = `https://www.google.com/search?tbm=isch&safe=active&hl=pt-BR&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) return null;
  const html = await response.text();

  const tupleRe = /\["(https?:\/\/[^"\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"\s]*)?)",\s*\d+,\s*\d+\]/gi;
  for (const match of html.matchAll(tupleRe)) {
    const candidate = match[1].replace(/\\u003d/g, "=").replace(/\\u0026/g, "&");
    if (isLikelyPoster(candidate)) return candidate;
  }

  const imgUrlRe = /imgurl=([^&"']+)/gi;
  for (const match of html.matchAll(imgUrlRe)) {
    try {
      const candidate = decodeURIComponent(match[1]);
      if (isLikelyPoster(candidate)) return candidate;
    } catch {
      // ignore decode errors
    }
  }

  const ogRe = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
  const og = html.match(ogRe);
  if (og && isLikelyPoster(og[1])) return og[1];

  return null;
}

async function tryITunes(title: string, year: number | null, signal: AbortSignal) {
  const term = year ? `${title} ${year}` : title;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=movie&limit=1`;
  const response = await fetch(url, { signal, headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as
    | { results?: Array<{ artworkUrl100?: string; artworkUrl60?: string }> }
    | null;
  const raw = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
  if (!raw) return null;
  return raw.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, "/600x600bb.$1");
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
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      const googleQuery = year
        ? `${title} ${year} filme poster`
        : `${title} filme poster`;

      const googleResult = await tryGoogleImages(googleQuery, controller.signal).catch(() => null);
      if (googleResult) {
        return NextResponse.json({ url: googleResult, source: "google" });
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
