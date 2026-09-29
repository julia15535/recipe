import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import "../../globals.css";
import { routing } from "@/i18n/routing";
import { getSiteConfig } from "@/lib/server/env";

// Корневой layout публичной части. Локаль — из root-params (i18n/request.ts), поэтому /ru и /en
// собираются статически при cacheComponents (ADR-0013).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  const { siteUrl, indexable } = getSiteConfig();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("siteName"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
