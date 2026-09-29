import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Link href="/" className={buttonVariants({ className: "h-11 self-start px-4 text-base" })}>
        {t("back")}
      </Link>
    </main>
  );
}
