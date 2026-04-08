import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email || "");
  await page.getByLabel("Senha").fill(password || "");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("**/");
}

test.describe("dashboard cockpit", () => {
  test.skip(!email || !password, "Configure E2E_EMAIL e E2E_PASSWORD para executar o fluxo autenticado.");

  test("quick action updates the attention queue and navigates with the planned kanban preset", async ({ page }) => {
    const stamp = Date.now();
    const taskTitle = `Dashboard E2E ${stamp}`;
    const today = new Date().toISOString().slice(0, 10);

    await login(page);

    await page.goto("/kanban");
    await page.getByRole("button", { name: /nova tarefa/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/o que precisa ser feito/i).fill(taskTitle);
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.getByRole("button", { name: /criar tarefa/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("dashboard-now")).toBeVisible();

    const queue = page.getByTestId("dashboard-attention-queue");
    const card = queue.locator("article").filter({ hasText: taskTitle }).first();

    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /iniciar agora/i })).toBeVisible();

    await card.getByRole("button", { name: /iniciar agora/i }).click();

    await expect(card.getByRole("button", { name: /concluir/i })).toBeVisible({ timeout: 15000 });
    await expect(card.getByRole("link", { name: /abrir no kanban/i })).toBeVisible();

    await card.getByRole("link", { name: /abrir no kanban/i }).click();
    await expect(page).toHaveURL(/\/kanban\?preset=today$/);
  });
});
