import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ADR-0011: flat config напрямую из eslint-config-next (без FlatCompat — он ломал деплой sup2).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  },
  {
    // lib/domain — чистые функции (пересчёт, округление, КБЖУ): без фреймворка, БД, env и сети.
    files: ["lib/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "next-intl",
                "next-intl/*",
                "react",
                "react-dom",
                "@/lib/server",
                "@/lib/server/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
                "server-only",
                "**/server/**",
                "node:*",
              ],
              message: "lib/domain — чистые функции без IO и фреймворка (ADR-0011).",
            },
          ],
        },
      ],
    },
  },
  {
    // Код Untitled UI — копия upstream (ADR-0015), правим минимально: его <img> (аватары, флаги) не трогаем.
    files: ["components/base/**", "components/application/**", "components/foundations/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // CLI-скрипты и тестовая обвязка пишут в консоль осознанно.
    files: ["scripts/**/*.mjs", "e2e/**/*.ts", "*.config.*"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tools/**",
    "_optional/**",
    "migrator/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
