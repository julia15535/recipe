"use client";

import { Button, type Props } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

// Кнопка проекта поверх Button из Untitled UI (сам компонент upstream не правим):
// по умолчанию размер xl — 44 px, удобно пальцем (ТЗ §21); форма «таблетка» (ADR-0015).
// У Button два варианта — кнопка и ссылка (с href), поэтому пробрасываем оба.
type LinkButtonProps = Extract<Props, { href: unknown }>;
type PlainButtonProps = Exclude<Props, LinkButtonProps>;

export function AppButton(props: Props) {
  const merged = { ...props, size: props.size ?? "xl", className: cx("rounded-full before:rounded-full", props.className) };
  return "href" in merged && merged.href !== undefined ? (
    <Button {...(merged as LinkButtonProps)} />
  ) : (
    <Button {...(merged as PlainButtonProps)} />
  );
}
