import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/lib/server/env";

// До запуска (SITE_INDEXABLE ≠ true) сайт закрыт целиком; значение запекается при сборке.
export default function robots(): MetadataRoute.Robots {
  const { indexable } = getSiteConfig();
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] } };
}
