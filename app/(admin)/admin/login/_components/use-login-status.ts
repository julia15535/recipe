"use client";

import { useEffect, useState } from "react";

export type WaitState = "waiting" | "offline" | "expired" | "rejected" | "ended";

type StatusReply = { state?: unknown; code?: unknown };

/**
 * Опрос статуса входа раз в 2 с и сразу при возврате на вкладку (из Telegram). Подтверждено —
 * переход в кабинет; другой код — попытку начали заново в другой вкладке, перерисовываем.
 */
export function useLoginStatus(code: string): WaitState {
  const [state, setState] = useState<WaitState>("waiting");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch("/api/auth/status", { method: "POST", cache: "no-store" });
        const reply = (await response.json()) as StatusReply;
        if (!active) return;
        if (reply.state === "signed-in") {
          active = false;
          window.location.replace("/admin");
        } else if (reply.state === "pending") {
          if (typeof reply.code === "string" && reply.code !== code) window.location.reload();
          else setState("waiting");
        } else if (reply.state === "expired" || reply.state === "rejected" || reply.state === "none") {
          active = false;
          setState(reply.state === "none" ? "ended" : reply.state);
        } else {
          setState("offline");
        }
      } catch {
        if (active) setState("offline");
      }
    }
    const timer = window.setInterval(() => active && void check(), 2000);
    const onVisible = () => active && document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code]);

  return state;
}
