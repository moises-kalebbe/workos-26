import { describe, expect, it } from "vitest";
import { getDateKeyInTimezone, getMillisecondsUntilNextDateChangeInTimezone } from "@/lib/timeline";

describe("timeline date helpers", () => {
  it("calcula a chave da data no fuso informado", () => {
    expect(getDateKeyInTimezone(new Date("2026-04-13T02:30:00.000Z"), "America/Sao_Paulo")).toBe("2026-04-12");
  });

  it("retorna o intervalo restante ate a proxima virada do dia no fuso", () => {
    const now = new Date("2026-04-13T02:59:58.250Z");
    const ms = getMillisecondsUntilNextDateChangeInTimezone(now, "America/Sao_Paulo");

    expect(ms).toBeGreaterThanOrEqual(1_750);
    expect(ms).toBeLessThanOrEqual(1_900);
  });
});
