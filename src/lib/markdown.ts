export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function getUniqueSlug(baseValue: string, existingSlugs: string[]): string {
  const baseSlug = slugify(baseValue) || "item";
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let index = 2;
  while (existingSlugs.includes(`${baseSlug}-${index}`)) {
    index += 1;
  }

  return `${baseSlug}-${index}`;
}

export function sanitizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function parseMarkdownFile(file: File): Promise<{ title: string; content: string; summary: string | null }> {
  const lowerName = file.name.toLowerCase();
  const isMarkdown = lowerName.endsWith(".md") || file.type === "text/markdown";

  if (!isMarkdown) {
    throw new Error("Arquivo invalido. Use um arquivo .md");
  }

  const content = await file.text();
  const firstHeadingMatch = content.match(/^#\s+(.+)$/m);
  const fallbackTitle = file.name.replace(/\.md$/i, "");
  const title = (firstHeadingMatch?.[1]?.trim() || fallbackTitle || "Skill sem titulo").trim();

  const summaryLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));

  return {
    title,
    content,
    summary: summaryLine || null,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadMarkdownFile(title: string, content: string) {
  const fileName = `${sanitizeFileName(title) || "skill"}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, fileName);
}


