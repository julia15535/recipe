import { defineConfig, devices } from "@playwright/test";

// Сессия владельца из e2e/auth.setup.ts (тот же путь — OWNER_STATE в e2e/support/telegram.ts). Без
// импорта из e2e/: папки нет в контексте сборки образа, а next build проверяет и этот файл.
const OWNER_STATE = "e2e/.auth/owner.json";

// e2e гоняем против собранного образа (CI: E2E_BASE_URL=http://127.0.0.1:3000). Локально без
// E2E_BASE_URL поднимается `pnpm start` (нужен предварительный `pnpm build`).
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3010";

export default defineConfig({
  testDir: "./e2e",
  // Заглушка Bot API (e2e/global-setup.ts): ответы бота входа без сети и настоящего бота.
  globalSetup: "./e2e/global-setup.ts",
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
  // setup входит владельцем один раз; закрытые страницы проверяются с этой сессией.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-375",
      dependencies: ["setup"],
      grepInvert: /@desktop/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true, storageState: OWNER_STATE },
    },
    {
      name: "desktop-1280",
      dependencies: ["setup"],
      grep: /@desktop/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: OWNER_STATE },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm start", url: `${baseURL}/api/health/live`, reuseExistingServer: true, timeout: 60_000 },
});
