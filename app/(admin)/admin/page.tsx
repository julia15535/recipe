import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// Заглушка: вход владельца через Telegram — отдельный план (ADR-0010).
export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Кабинет владельца</h1>
      <p className="text-base text-muted-foreground">Вход через Telegram появится на следующем этапе.</p>
      <Link href="/ru" className={buttonVariants({ variant: "outline", className: "h-11 self-start px-4 text-base" })}>
        На сайт
      </Link>
    </main>
  );
}
