import { useLocale, useTranslations } from "next-intl";

import { AppButton } from "@/components/app-button";

// 404 внутри локали; при Cache Components часто «мягкая» (notFound() внутри потока — код 200, но noindex):
// принято в плане public-pages. Ссылка «на главную» — сразу на свою локаль.
export default function LocaleNotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-xs text-primary">{t("title")}</h1>
      <AppButton href={`/${locale}`} className="self-start">
        {t("back")}
      </AppButton>
    </main>
  );
}
