import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";

import { AppButton } from "@/components/app-button";
import { localizedAlternates } from "@/lib/i18n/alternates";

// Заглушка главной (каркас): проверяет локали, шрифты и бренд. Настоящая главная — после схемы
// каталога и поиска.
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localizedAlternates(await getLocale(), "/") };
}

export default function HomePage() {
  const t = useTranslations("Home");
  const otherLocale = useLocale() === "ru" ? "en" : "ru";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-sm text-primary">{t("title")}</h1>
      <p className="text-lg text-tertiary">{t("lead")}</p>
      <AppButton color="secondary" href={`/${otherLocale}`} className="self-start">
        {t("switchLanguage")}
      </AppButton>
    </main>
  );
}
