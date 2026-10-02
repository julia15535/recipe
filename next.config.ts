import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// ADR-0011: базовые заголовки безопасности. Строгая CSP с nonce — у кабинета /admin (proxy.ts);
// публичным страницам от встраивания в iframe пока хватает X-Frame-Options.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
];

// www → основной домен. Здесь, а не в proxy.ts: redirects() срабатывают раньше proxy и покрывают
// и robots.txt, и /api, и статику, которые matcher proxy пропускает.
const siteHost = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  // next dev иначе дописывает свой блок в AGENTS.md/CLAUDE.md — CLAUDE.md проекта трогать нельзя.
  agentRules: false,
  async headers() {
    // Кабинет не передаёт адрес страницы никуда (ссылка на бота уходит в Telegram без Referer).
    const adminHeaders = [{ key: "Referrer-Policy", value: "no-referrer" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
  async redirects() {
    if (!siteHost || siteHost.startsWith("localhost") || siteHost.startsWith("127.")) return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${siteHost}` }],
        destination: `https://${siteHost}/:path*`,
        statusCode: 301,
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
