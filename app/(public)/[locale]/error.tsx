"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Button className="h-11 self-start px-4 text-base" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </main>
  );
}
