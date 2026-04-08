import { describe, expect, it } from "vitest";

import { GENERAL_MCP_SKILLS_SEED, getGeneralMcpSkillUpserts } from "@/lib/generalMcpSkills";

describe("generalMcpSkills", () => {
  it("keeps all three system skills with complete markdown", () => {
    expect(GENERAL_MCP_SKILLS_SEED).toHaveLength(3);
    expect(GENERAL_MCP_SKILLS_SEED.every((skill) => skill.contentMd.includes("##"))).toBe(true);
    expect(
      GENERAL_MCP_SKILLS_SEED.find((skill) => skill.slug === "setup-mcp-n8n-supabase")?.contentMd,
    ).toContain("## Exemplo de configuracao");
  });

  it("updates outdated seed records and preserves manual records", () => {
    const rows = getGeneralMcpSkillUpserts(
      [
        {
          slug: "n8n-specialist-mcp",
          title: "n8n Specialist (MCP)",
          summary: "resumo antigo",
          content_md: "# antigo",
          source_type: "seed",
          category_id: "old-category",
        },
        {
          slug: "supabase-specialist-mcp",
          title: "Supabase Specialist (MCP)",
          summary: "custom",
          content_md: "# custom",
          source_type: "manual",
          category_id: "manual-category",
        },
      ],
      "user-1",
      "geral-category",
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.slug).sort()).toEqual([
      "n8n-specialist-mcp",
      "setup-mcp-n8n-supabase",
    ]);
    expect(rows.every((row) => row.category_id === "geral-category")).toBe(true);
    expect(rows.every((row) => row.source_type === "seed")).toBe(true);
  });
});
