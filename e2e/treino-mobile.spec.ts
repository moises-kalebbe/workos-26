import { devices, expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

const MOBILE_DEVICES: Array<{ name: string; options: BrowserContextOptions }> = [
  { name: "iPhone 12", options: devices["iPhone 12"] },
  { name: "Pixel 5", options: devices["Pixel 5"] },
];

async function assertNoHorizontalDocumentOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.rootScrollWidth, `${label}: root scroll width should stay within the viewport`).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.bodyScrollWidth, `${label}: body scroll width should stay within the viewport`).toBeLessThanOrEqual(metrics.viewportWidth);
}

async function waitForTreinoReady(page: Page) {
  await page.goto("/treino", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Treino" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("tab", { name: /Hoje/i })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("button", { name: /Abrir sessao do dia/i })).toBeVisible({ timeout: 120_000 });
}

async function assertTouchTargets(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    tabHeights: Array.from(document.querySelectorAll('[role="tab"]')).map((element) =>
      Math.round((element as HTMLElement).getBoundingClientRect().height)),
    ctaHeight: Math.round(
      (Array.from(document.querySelectorAll("button")).find((element) =>
        /abrir sessao do dia/i.test(element.textContent || "")) as HTMLElement | undefined)?.getBoundingClientRect().height || 0,
    ),
  }));

  expect(metrics.tabHeights.length, `${label}: tabs should exist`).toBeGreaterThan(0);
  for (const height of metrics.tabHeights) {
    expect(height, `${label}: each tab should provide a touch target >= 44px`).toBeGreaterThanOrEqual(44);
  }
  expect(metrics.ctaHeight, `${label}: CTA should provide a touch target >= 44px`).toBeGreaterThanOrEqual(44);
}

async function assertNoBlockingDialog(page: Page, label: string) {
  await expect(page.locator('[role="dialog"]'), `${label}: treino should not auto-open a blocking dialog on mobile`).toHaveCount(0);
}

async function assertSessionHandoff(page: Page, label: string) {
  const cta = page.getByRole("button", { name: /Abrir sessao do dia/i });
  await cta.click();

  const activeTab = page.getByRole("tab", { name: /Sessao/i });
  await expect(activeTab, `${label}: should switch to the session tab`).toHaveAttribute("data-state", "active");
  await expect(page.getByText(/Registro de sessao/i), `${label}: session content should be visible after opening the daily session`).toBeVisible();
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

test.describe("treino mobile session flow", () => {
  for (const device of MOBILE_DEVICES) {
    test(`${device.name}: daily session stays touch-friendly and opens without document overflow`, async ({ browser }) => {
      test.setTimeout(120_000);

      await withMobilePage(browser, device.options, async (page) => {
        await waitForTreinoReady(page);
        await assertNoBlockingDialog(page, `${device.name}.initial`);
        await assertNoHorizontalDocumentOverflow(page, `${device.name}.initial`);
        await assertTouchTargets(page, `${device.name}.initial`);
        await assertSessionHandoff(page, `${device.name}.handoff`);
        await assertNoHorizontalDocumentOverflow(page, `${device.name}.sessao`);
      });
    });
  }
});
