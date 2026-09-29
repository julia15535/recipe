"use client";

import { useEffect, useState } from "react";
import type { Key } from "react-aria-components";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";

type Palette = "a" | "b";

// Выбранный вариант переключателя должен быть заметен с первого взгляда (у плиты, с телефона).
export const SEGMENT = "min-h-11 flex-1 justify-center selected:bg-brand-primary selected:text-brand-secondary";

// Вариант B включается атрибутом на <html> (styles/brand.css) — только на этой пробной странице.
function applyPalette(palette: Palette) {
  if (palette === "b") document.documentElement.dataset.palette = "b";
  else delete document.documentElement.dataset.palette;
}

export function PaletteSwitch() {
  const [palette, setPalette] = useState<Palette>("a");

  // Уходя со страницы, возвращаем основную палитру.
  useEffect(() => () => applyPalette("a"), []);

  const choose = (keys: Set<Key>) => {
    const next: Palette = keys.has("b") ? "b" : "a";
    setPalette(next);
    applyPalette(next);
  };

  return (
    <ButtonGroup
      aria-label="Вариант палитры"
      size="lg"
      selectedKeys={[palette]}
      onSelectionChange={choose}
      disallowEmptySelection
      className="w-full"
    >
      <ButtonGroupItem id="a" className={SEGMENT}>
        A · олива
      </ButtonGroupItem>
      <ButtonGroupItem id="b" className={SEGMENT}>
        B · роза
      </ButtonGroupItem>
    </ButtonGroup>
  );
}
