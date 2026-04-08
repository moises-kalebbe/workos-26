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

test.describe("workos smoke", () => {
  test.skip(!email || !password, "Configure E2E_EMAIL e E2E_PASSWORD para executar smoke autenticado.");

  test("auth + navegacao principal", async ({ page }) => {
    await login(page);

    const routes = ["/", "/tracker", "/kanban", "/agenda", "/financeiro", "/vault", "/reports", "/settings", "/skills", "/second-brain"];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route === "/" ? "\\/$" : route}$`));
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("tracker create + kanban create + vault create", async ({ page }) => {
    await login(page);

    const stamp = Date.now();

    await page.goto("/tracker");
    await page.getByRole("button", { name: /novo projeto/i }).click();
    await page.getByPlaceholder(/website redesign/i).fill(`Projeto E2E ${stamp}`);
    await page.getByRole("button", { name: /criar projeto/i }).click();
    await expect(page.getByText(`Projeto E2E ${stamp}`)).toBeVisible();

    await page.goto("/kanban");
    await page.getByRole("button", { name: /nova tarefa/i }).click();
    await page.getByPlaceholder(/o que precisa ser feito/i).fill(`Tarefa E2E ${stamp}`);
    await page.getByRole("button", { name: /criar tarefa/i }).click();
    await expect(page.getByText(`Tarefa E2E ${stamp}`)).toBeVisible();

    await page.goto("/vault");
    await page.getByRole("button", { name: /nova credencial/i }).click();
    await page.getByPlaceholder(/gmail, aws/i).fill(`Servico E2E ${stamp}`);
    await page.getByPlaceholder(/••••••••/).first().fill("senha-e2e-123");
    await page.getByRole("button", { name: /salvar credencial/i }).click();
    await expect(page.getByText(`Servico E2E ${stamp}`)).toBeVisible();
  });
});

