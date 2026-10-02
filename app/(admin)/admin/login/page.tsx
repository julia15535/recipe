import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loadWaiting } from "@/lib/server/auth/login-view";
import { getOwner } from "@/lib/server/auth/owner";
import { getAuthConfig } from "@/lib/server/env";

import { LoginQr } from "./_components/login-qr";
import { LoginStart } from "./_components/login-start";
import { LoginWaiting } from "./_components/login-waiting";

export const metadata: Metadata = { title: "Вход · Кабинет владельца" };

// Вход владельца через своего Telegram-бота (план owner-login-telegram): GET ничего не пишет в БД;
// попытку создаёт кнопка (POST), дальше страница ждёт подтверждения в Telegram.
export default async function LoginPage() {
  if (await getOwner()) redirect("/admin");
  const config = getAuthConfig();
  const waiting = config ? await loadWaiting(config.botUsername) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      {waiting ? (
        <LoginWaiting code={waiting.code} link={waiting.link} qr={<LoginQr value={waiting.link} />} />
      ) : (
        <LoginStart available={config !== null} />
      )}
    </main>
  );
}
