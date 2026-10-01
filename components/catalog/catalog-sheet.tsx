"use client";

import { ChevronDown, ChevronRight, LayoutGrid, X } from "lucide-react";
import { Heading, Link } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";

import { sectionIcon } from "./section-icons";
import type { CatalogSection } from "./types";

// Каталог на телефоне: «выпадающий список» владельца — нижний лист с крупными строками под большой
// палец (ui-rules: без мелких desktop-dropdown). Фокус внутри, Esc, закрытие по фону, запрет прокрутки
// страницы и возврат фокуса на кнопку даёт React Aria (Modal из Untitled UI).
type Props = { sections: CatalogSection[]; label: string; closeLabel: string; className?: string };

export function CatalogSheet({ sections, label, closeLabel, className }: Props) {
  return (
    <div className={className}>
      <DialogTrigger>
        <AppButton color="secondary" iconLeading={LayoutGrid} iconTrailing={ChevronDown} className="w-full">
          {label}
        </AppButton>
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
                    {sections.map((section) => {
                      const Icon = sectionIcon(section.id);
                      return (
                        <li key={section.id}>
                          <Link
                            href={section.href}
                            onPress={close}
                            className="flex min-h-12 items-center gap-3 rounded-lg py-2 text-lg text-primary outline-brand focus-visible:outline-2"
                          >
                            <Icon className="size-6 shrink-0 text-brand-secondary" aria-hidden />
                            <span className="flex-1">{section.label}</span>
                            <ChevronRight className="size-5 text-quaternary" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
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
