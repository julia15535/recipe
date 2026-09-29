import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localizedAlternates } from "@/lib/i18n/alternates";

// Заглушка главной (каркас): проверяет локали, токены темы и shadcn-стили. Настоящая главная —
// после схемы каталога и поиска.
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localizedAlternates(await getLocale(), "/") };
}

export default function HomePage() {
  const t = useTranslations("Home");
  const otherLocale = useLocale() === "ru" ? "en" : "ru";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-base text-muted-foreground">{t("lead")}</p>
      <Link
        href="/"
        locale={otherLocale}
        className={buttonVariants({ variant: "outline", className: "h-11 self-start px-4 text-base" })}
      >
        {t("switchLanguage")}
      </Link>
    </main>
  );
}
