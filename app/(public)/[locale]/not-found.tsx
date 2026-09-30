import { useTranslations } from "next-intl";

import { AppButton } from "@/components/app-button";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-xs text-primary">{t("title")}</h1>
      <AppButton href="/" className="self-start">
        {t("back")}
      </AppButton>
    </main>
  );
}
