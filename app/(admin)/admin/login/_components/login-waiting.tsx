"use client";

import { Send } from "lucide-react";
import type { ReactNode } from "react";

import { AppButton } from "@/components/app-button";

import { StartLoginForm } from "./start-login-form";
import { useLoginStatus, type WaitState } from "./use-login-status";

const ENDED: Partial<Record<WaitState, string>> = {
  expired: "Время на вход вышло (ссылка действует 10 минут). Начните заново.",
  rejected: "Вход отменён в Telegram. Если это были вы — начните заново.",
  ended: "Эта попытка входа закончилась. Начните заново.",
};

type Props = { code: string; link: string; qr: ReactNode };

/** Ожидание подтверждения: код для сверки, ссылка на бота, QR для входа с компьютера. */
export function LoginWaiting({ code, link, qr }: Props) {
  const state = useLoginStatus(code);
  const ended = ENDED[state];

  if (ended) {
    return (
      <>
        <h1 className="font-display text-display-xs text-primary">Вход не завершён</h1>
        <p role="alert" className="text-lg text-secondary">
          {ended}
        </p>
        <StartLoginForm restart />
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-xs text-primary">Подтвердите вход в Telegram</h1>
        <p className="text-md text-tertiary">Ссылка действует 10 минут.</p>
      </header>
      <div className="flex flex-col items-start gap-1 rounded-2xl bg-accent-50 p-4">
        <p className="text-sm text-secondary">Код на этом экране</p>
        <p data-login-code className="font-display text-display-lg tracking-[0.25em] text-primary">
          {code}
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-md text-secondary">
        <li>Нажмите «Открыть Telegram», там — «Старт».</li>
        <li>Сверьте код в сообщении бота с кодом здесь.</li>
        <li>Нажмите «Подтвердить» — эта страница сама откроет кабинет.</li>
      </ol>
      <AppButton href={link} target="_blank" rel="noopener noreferrer" iconLeading={Send} className="self-start">
        Открыть Telegram
      </AppButton>
      <div className="flex flex-col gap-3 max-md:hidden">
        <p className="text-md text-secondary">Входите с компьютера? Отсканируйте код камерой телефона:</p>
        {qr}
      </div>
      <p role="status" className="text-md text-tertiary">
        {state === "offline" ? "Нет связи с сайтом — пробуем снова…" : "Ждём подтверждения в Telegram…"}
      </p>
      <StartLoginForm restart primary={false} />
    </>
  );
}
