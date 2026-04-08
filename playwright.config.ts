import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function readLocalEnvValue(name: string) {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      return null;
    }

    const prefix = `${name}=`;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      if (!line.startsWith(prefix)) {
        continue;
      }

      return line.slice(prefix.length).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    return null;
  }

  return null;
}

const PORT = Number(process.env.PORT || 3007);
const localDevAuthUserId =
  process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID ||
  process.env.DEV_AUTH_USER_ID ||
  readLocalEnvValue("NEXT_PUBLIC_DEV_AUTH_USER_ID") ||
  readLocalEnvValue("DEV_AUTH_USER_ID");
const useDevServer =
  process.env.PLAYWRIGHT_DEV_SERVER === "true" ||
  (process.env.PLAYWRIGHT_DEV_SERVER !== "false" && Boolean(localDevAuthUserId));

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: useDevServer ? "npm run dev" : "npm run build && npm run start",
        env: {
          ...process.env,
          PORT: String(PORT),
        },
        port: PORT,
        reuseExistingServer: true,
        timeout: useDevServer ? 180_000 : 300_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

