"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import { Heading, Link } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";

import { SectionIcon } from "./section-icon";
import type { CatalogSection } from "./types";

// Каталог на телефоне: привычный значок «меню» (три полоски) в строке шапки слева от названия (владелец
// 01.10: «привычно для пользователей, что это типа меню»); «выпадающий список» — нижний лист с крупными строками под большой
// палец (ui-rules: без мелких desktop-dropdown); пустой раздел — бледная строка «Пока нет рецептов» (ADR-0020). Фокус внутри, Esc, закрытие по фону, запрет прокрутки
// страницы и возврат фокуса на кнопку даёт React Aria (Modal из Untitled UI).
type Props = { sections: CatalogSection[]; label: string; closeLabel: string; className?: string };

export function CatalogSheet({ sections, label, closeLabel, className }: Props) {
  return (
    <div className={className}>
      <DialogTrigger>
        {/* Значок «меню» — графитовый и чуть крупнее обычного: его должно быть сразу видно (владелец 01.10). */}
        <AppButton
          color="tertiary"
          size="lg"
          iconLeading={Menu}
          aria-label={label}
          className="*:data-icon:size-6 *:data-icon:text-fg-primary hover:*:data-icon:text-fg-primary"
        />
        <ModalOverlay
          isDismissable
          className="items-end px-0 pb-0 motion-reduce:animate-none sm:items-end sm:px-0 [--modal-pb:0px] sm:[--modal-pb:0px]"
        >
          <Modal className="max-w-screen-sm rounded-t-3xl rounded-b-none slide-in-from-bottom-1/4 motion-reduce:animate-none sm:rounded-t-3xl sm:rounded-b-none">
            <Dialog className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {({ close }) => (
                <>
                  <div className="flex items-center justify-between gap-3 pb-1">
                    <Heading slot="title" className="font-display text-display-xs text-primary">
                      {label}
                    </Heading>
                    <AppButton color="tertiary" iconLeading={X} aria-label={closeLabel} onPress={close} />
                  </div>
                  <ul className="flex flex-col divide-y divide-secondary">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <SheetRow section={section} onNavigate={close} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}

// Строка листа: текущий раздел — выделен, не ссылка; пустой — бледный с «Пока нет рецептов» (ADR-0020).
function SheetRow({ section, onNavigate }: { section: CatalogSection; onNavigate: () => void }) {
  if (section.current)
    return (
      <div aria-current="page" className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg bg-accent-100 px-2 py-2 text-lg text-primary" data-current>
        <SectionIcon id={section.id} className="size-6 shrink-0 text-brand-secondary" />
        <span className="flex-1">{section.label}</span>
      </div>
    );
  if (section.empty)
    return (
      <div className="flex min-h-12 items-center gap-3 py-2 text-quaternary" data-empty>
        <SectionIcon id={section.id} className="size-6 shrink-0 text-brand-secondary opacity-35" />
        <span className="flex flex-col">
          <span className="text-lg">{section.label}</span>
          <span className="text-sm">Пока нет рецептов</span>
        </span>
      </div>
    );
  return (
    <Link
      href={section.href}
      onPress={onNavigate}
      className="flex min-h-12 items-center gap-3 rounded-lg py-2 text-lg text-primary outline-brand focus-visible:outline-2"
    >
      <SectionIcon id={section.id} className="size-6 shrink-0 text-brand-secondary" />
      <span className="flex-1">{section.label}</span>
      <ChevronRight className="size-5 text-quaternary" aria-hidden />
    </Link>
  );
}
