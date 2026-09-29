"use client";

import { useTranslations } from "next-intl";

import { AppButton } from "@/components/app-button";

export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-xs font-semibold text-primary">{t("title")}</h1>
      <AppButton className="self-start" onPress={() => retry()}>
        {t("retry")}
      </AppButton>
    </main>
  );
}
