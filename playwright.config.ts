import { defineConfig, devices } from "@playwright/test";

// e2e гоняем против собранного образа (CI: E2E_BASE_URL=http://127.0.0.1:3000). Локально без
// E2E_BASE_URL поднимается `pnpm start` (нужен предварительный `pnpm build`).
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3010";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Chromium на ядре 7.x падает с песочницей (грабля sib/remlab).
    launchOptions: { args: ["--no-sandbox"] },
  },
  // Основная проверка — телефон (mobile-first); компьютер — только тесты с меткой @desktop.
  projects: [
    {
      name: "mobile-375",
      grepInvert: /@desktop/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true },
    },
    {
      name: "desktop-1280",
      grep: /@desktop/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start", url: `${baseURL}/api/health/live`, reuseExistingServer: true, timeout: 60_000 },
});
