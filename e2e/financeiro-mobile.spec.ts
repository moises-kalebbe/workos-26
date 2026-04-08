import { devices, expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const MOBILE_DEVICES: Array<{ name: string; options: BrowserContextOptions }> = [
  { name: "iPhone 12", options: devices["iPhone 12"] },
  { name: "Pixel 5", options: devices["Pixel 5"] },
];

async function assertNoHorizontalDocumentOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    rootClientWidth: document.documentElement.clientWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.rootScrollWidth, `${label}: root scroll width should stay within the viewport`).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.bodyScrollWidth, `${label}: body scroll width should stay within the viewport`).toBeLessThanOrEqual(metrics.viewportWidth);

  return metrics;
}

async function waitForFinanceiroReady(page: Page) {
  await page.goto("/financeiro", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.textContent?.includes("Carregando financeiro..."), { timeout: 120_000 });
  await expect(page.getByRole("tab", { name: /Painel|Executivo/i }).first()).toBeVisible({ timeout: 120_000 });
}

async function openFinanceTab(page: Page, index: number, label: string) {
  const candidates = [
    /Painel|Executivo/i,
    /Lanc\.|Lancamentos/i,
    /Contr\.|Contratos/i,
  ];
  const tab = page.getByRole("tab", { name: candidates[index] }).first();

  await tab.click();
  await expect(tab, `${label}: tab should become active`).toHaveAttribute("data-state", "active", { timeout: 5000 });
}

async function assertFinanceTabsStayWithinViewport(page: Page) {
  await waitForFinanceiroReady(page);

  await assertNoHorizontalDocumentOverflow(page, "financeiro.executivo");

  await openFinanceTab(page, 1, "financeiro.lancamentos");
  await assertNoHorizontalDocumentOverflow(page, "financeiro.lancamentos");

  await openFinanceTab(page, 2, "financeiro.contratos");
  await assertNoHorizontalDocumentOverflow(page, "financeiro.contratos");
}

async function assertMobileNavScrollIsIsolated(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("h1")).toBeVisible();

  const metrics = await assertNoHorizontalDocumentOverflow(page, `${route}.document`);
  const navMetrics = await page.locator("[data-mobile-nav='true']").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  expect(navMetrics.scrollWidth, `${route}: mobile nav should never under-report its own width`).toBeGreaterThanOrEqual(navMetrics.clientWidth);
  expect(navMetrics.clientWidth, `${route}: mobile nav should stay constrained to the viewport width`).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.rootScrollWidth, `${route}: document should stay isolated from nav scrolling`).toBe(metrics.viewportWidth);
}

async function withMobilePage<T>(
  browser: Browser,
  options: BrowserContextOptions,
  callback: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext(options);
  const page = await context.newPage();

  try {
    return await callback(page);
  } finally {
    await context.close().catch(() => {});
  }
}

test.describe("financeiro mobile overflow regression", () => {
  for (const device of MOBILE_DEVICES) {
    test(`${device.name}: financeiro tabs do not create horizontal document overflow`, async ({ browser }) => {
      test.setTimeout(120_000);
      await withMobilePage(browser, device.options, async (page) => {
        await assertFinanceTabsStayWithinViewport(page);
      });
    });
  }

  test("iPhone 12: financeiro, kanban and settings keep nav overflow isolated", async ({ browser }) => {
    await withMobilePage(browser, devices["iPhone 12"], async (page) => {
      for (const route of ["/financeiro", "/kanban", "/settings"]) {
        await assertMobileNavScrollIsIsolated(page, route);
      }
    });
  });
});
