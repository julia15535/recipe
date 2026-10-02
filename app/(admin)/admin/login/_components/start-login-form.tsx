"use client";

import { RotateCcw, Send } from "lucide-react";
import { useActionState } from "react";

import { AppButton } from "@/components/app-button";

import { startLogin } from "../actions";
import { LOGIN_NOTICES } from "./login-notices";

/** Кнопка новой попытки входа (POST): «Войти через Telegram» или «Начать заново». */
export function StartLoginForm({ restart = false, primary = true }: { restart?: boolean; primary?: boolean }) {
  const [state, action, pending] = useActionState(startLogin, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      {restart && <input type="hidden" name="restart" value="1" />}
      {state && (
        <p role="alert" className="rounded-xl bg-accent-50 p-4 text-md text-primary">
          {LOGIN_NOTICES[state.notice]}
        </p>
      )}
      <AppButton
        type="submit"
        color={primary ? "primary" : "secondary"}
        iconLeading={restart ? RotateCcw : Send}
        isDisabled={pending}
        className="self-start"
      >
        {restart ? "Начать заново" : "Войти через Telegram"}
      </AppButton>
    </form>
  );
}
