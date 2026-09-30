"use client";

import { type CSSProperties, type ReactNode, createContext, useContext, useState } from "react";
import type { Key } from "react-aria-components";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";

import { SEGMENT } from "./segment";

// Выбор шрифта заголовков на пробной странице: Lora (по умолчанию на сайте), Literata, Alegreya —
// все с кириллицей. Шрифт меняется для всей страницы через переменную --font-display.
export const HEADING_FONTS = [
  { id: "lora", label: "Lora", variable: "var(--font-lora)" },
  { id: "literata", label: "Literata", variable: "var(--font-literata)" },
  { id: "alegreya", label: "Alegreya", variable: "var(--font-alegreya)" },
] as const;

type HeadingFont = (typeof HEADING_FONTS)[number]["id"];

const HeadingFontContext = createContext<{ font: HeadingFont; setFont: (font: HeadingFont) => void } | null>(null);

export function HeadingFontScope({ className, children }: { className: string; children: ReactNode }) {
  const [font, setFont] = useState<HeadingFont>("lora");
  const variable = HEADING_FONTS.find((item) => item.id === font)?.variable ?? "var(--font-lora)";
  return (
    <HeadingFontContext.Provider value={{ font, setFont }}>
      <div className={className} data-heading={font} style={{ "--font-display": `${variable}, Georgia, serif` } as CSSProperties}>
        {children}
      </div>
    </HeadingFontContext.Provider>
  );
}

export function HeadingFontSwitch() {
  const context = useContext(HeadingFontContext);
  if (!context) throw new Error("HeadingFontSwitch должен быть внутри HeadingFontScope");
  const choose = (keys: Set<Key>) => {
    const next = HEADING_FONTS.find((item) => keys.has(item.id));
    if (next) context.setFont(next.id);
  };
  return (
    <ButtonGroup
      aria-label="Шрифт заголовков"
      size="lg"
      selectedKeys={[context.font]}
      onSelectionChange={choose}
      disallowEmptySelection
      className="w-full"
    >
      {HEADING_FONTS.map((item) => (
        <ButtonGroupItem key={item.id} id={item.id} className={SEGMENT}>
          {item.label}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
}
