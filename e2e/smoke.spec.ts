import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Parameters<(typeof test)["beforeEach"]>[0]["page"]) {
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

    const routes = ["/", "/tracker", "/kanban", "/agenda", "/vault", "/reports", "/settings", "/skills", "/second-brain"];

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

  test("quick start com sugestao e fallback", async ({ page }) => {
    await login(page);

    const stamp = Date.now();
    const projectName = `Projeto QS E2E ${stamp}`;
    const taskName = `Tarefa QS E2E ${stamp}`;
    const fallbackTaskName = `Fallback QS E2E ${stamp}`;
    const today = new Date().toISOString().slice(0, 10);

    await page.goto("/tracker");
    await page.getByRole("button", { name: /novo projeto/i }).click();
    await page.getByPlaceholder(/website redesign/i).fill(projectName);
    await page.getByRole("button", { name: /criar projeto/i }).click();
    await expect(page.getByText(projectName)).toBeVisible();

    await page.goto("/kanban");
    await page.getByRole("button", { name: /nova tarefa/i }).click();
    await page.getByPlaceholder(/o que precisa ser feito/i).fill(taskName);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: projectName }).click();
    await page.locator('input[type="date"]').first().fill(today);
    await page.getByRole("button", { name: /criar tarefa/i }).click();
    await expect(page.getByText(taskName)).toBeVisible();

    await page.goto("/tracker");
    await page.getByRole("button", { name: /iniciar agora/i }).click();
    await expect(page.getByText(/trabalhando agora/i)).toBeVisible();
    await page.getByRole("button", { name: /finalizar/i }).click();

    await page.goto("/tracker?quickStartMinScore=999");
    await page.getByRole("button", { name: /iniciar agora/i }).click();
    await expect(page.getByRole("heading", { name: /criar tarefa rapida/i })).toBeVisible();
    await page.getByPlaceholder(/foco rapido/i).fill(fallbackTaskName);
    await page.getByRole("button", { name: /criar e iniciar/i }).click();
    await expect(page.getByText(/trabalhando agora/i)).toBeVisible();

    await page.goto("/kanban");
    await expect(page.getByText(fallbackTaskName)).toBeVisible();
  });
});

