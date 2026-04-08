import { describe, expect, it } from "vitest";
import {
  analyzeSourceText,
  fixSourceText,
} from "../../scripts/portuguese-accent-audit-core.mjs";

type AuditFinding = {
  before: string;
  after: string;
  filePath: string;
  line: number;
  column: number;
  replacements: Array<{ from: string; to: string }>;
};

describe("portuguese accent audit", () => {
  it("detects and fixes missing accents in user-facing strings", () => {
    const sourceText = `
      const emptyMessage = "Configuracoes gerais";

      export function Screen() {
        return (
          <button aria-label="Abrir busca rapida" title="Pagina nao encontrada">
            Reuniao confirmada para revisao da solucao
          </button>
        );
      }
    `;

    const findings = analyzeSourceText(sourceText, "src/views/Screen.tsx");

    const correctedTexts = findings.map((finding) => finding.after.trim());

    expect(correctedTexts).toEqual(
      expect.arrayContaining([
        "Configurações gerais",
        "Abrir busca rápida",
        "Página não encontrada",
        "Reunião confirmada para revisão da solução",
      ]),
    );

    const fixed = fixSourceText(sourceText, "src/views/Screen.tsx");

    expect(fixed.changed).toBe(true);
    expect(fixed.output).toContain(`const emptyMessage = "Configurações gerais";`);
    expect(fixed.output).toContain(`aria-label="Abrir busca rápida"`);
    expect(fixed.output).toContain(`title="Página não encontrada"`);
    expect(fixed.output).toContain("Reunião confirmada para revisão da solução");
  });

  it("does not alter identifiers, slugs, routes, or import paths", () => {
    const sourceText = `
      import { cn } from "@/lib/utils";

      const PaginaNaoEncontrada = "component-id";
      const routePath = "/pagina-nao-encontrada";
      const statusSlug = "reuniao-confirmada";
      const title = "Pagina nao encontrada";

      export { cn, PaginaNaoEncontrada, routePath, statusSlug, title };
    `;

    const fixed = fixSourceText(sourceText, "src/config/routes.ts");

    expect(fixed.output).toContain(`const PaginaNaoEncontrada = "component-id";`);
    expect(fixed.output).toContain(`const routePath = "/pagina-nao-encontrada";`);
    expect(fixed.output).toContain(`const statusSlug = "reuniao-confirmada";`);
    expect(fixed.output).toContain(`const title = "Página não encontrada";`);
    expect(fixed.output).toContain(`import { cn } from "@/lib/utils";`);
  });
});
