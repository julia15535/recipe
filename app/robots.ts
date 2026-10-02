import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/lib/server/env";

// До запуска (SITE_INDEXABLE ≠ true) сайт закрыт целиком. Значение запекается при сборке (robots, layout), а
// metadata разделов и рецептов читает его при запросе — открывать в CI (build-arg) И в /opt/recipe/web.env.
export default function robots(): MetadataRoute.Robots {
  const { indexable } = getSiteConfig();
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] } };
}
