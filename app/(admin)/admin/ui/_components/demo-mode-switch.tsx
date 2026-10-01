"use client";

import type { Key } from "react-aria-components";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";

import { setDemoMode, useDemoMode } from "../_demo/demo-mode";
import { DEMO_MODES, type DemoMode } from "../_demo/demo-selection";

const LABELS: Record<DemoMode, { text: string; full: string }> = {
  all: { text: "все", full: "Все рецепты" },
  first: { text: "3", full: "Первые 3 рецепта" },
  none: { text: "0", full: "Ни одного рецепта" },
};

const isMode = (key: Key | undefined): key is DemoMode => DEMO_MODES.some((mode) => mode === key);

// Переключатель демо «Рецептов: все / 3 / 0» — показать, как разделы каталога «оживают» (ADR-0020).
export function DemoModeSwitch() {
  const mode = useDemoMode();
  const change = (keys: Set<Key>) => {
    const [next] = keys;
    if (isMode(next)) setDemoMode(next);
  };
  return (
    <div className="flex items-center gap-2">
      <span id="demo-mode-label">Рецептов:</span>
      <ButtonGroup aria-labelledby="demo-mode-label" size="sm" selectedKeys={[mode]} onSelectionChange={change} disallowEmptySelection>
        {DEMO_MODES.map((id) => (
          <ButtonGroupItem key={id} id={id} aria-label={LABELS[id].full} className="min-h-11 min-w-11 justify-center selected:bg-accent-200">
            {LABELS[id].text}
          </ButtonGroupItem>
        ))}
      </ButtonGroup>
    </div>
  );
}
