"use client";

import { useSyncExternalStore } from "react";

import { DEMO_MODES, type DemoMode } from "./demo-selection";

// Режим демо общий для главной и поиска (страницы рецептов от него не зависят) — хранится в браузере (localStorage). На сервере и до чтения —
// «все рецепты»; браузер может запретить хранилище — тогда тоже «все».
const KEY = "recipe-demo-mode";
const EVENT = "recipe-demo-mode-change";

const isMode = (value: unknown): value is DemoMode => DEMO_MODES.some((mode) => mode === value);

function read(): DemoMode {
  try {
    const value = window.localStorage.getItem(KEY);
    return isMode(value) ? value : "all";
  } catch {
    return "all";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useDemoMode(): DemoMode {
  return useSyncExternalStore(subscribe, read, () => "all");
}

export function setDemoMode(mode: DemoMode) {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // хранилище запрещено — режим не меняется, остаётся «все»
  }
  window.dispatchEvent(new Event(EVENT));
}
