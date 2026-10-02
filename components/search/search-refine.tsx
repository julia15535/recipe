"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import type { Selection } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

const CHIP = "min-h-11 rounded-full px-4 text-md";
const CAPTION = "text-sm font-semibold text-secondary";

type Option = { code: string; label: string };
type Props = {
  sections: readonly Option[];
  section: string | null;
  onSectionChange: (section: string | null) => void;
  tags: readonly Option[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

// Уточнение без сложной формы (ADR-0002): раздел (один, можно снять; только разделы с рецептами — ADR-0020) и
// теги состава (ADR-0019). На телефоне «таблетки» не стоят перед результатами — спрятаны за «Уточнить»; если
// уточнение уже задано (из адреса), блок открыт сразу.
export function SearchRefine({ sections, section, onSectionChange, tags, selectedTags, onTagsChange }: Props) {
  const [open, setOpen] = useState(section !== null || selectedTags.length > 0);
  const panelId = useId();
  const active = (section ? 1 : 0) + selectedTags.length;
  const pick = (selection: Selection) => (selection === "all" ? [] : [...selection].map(String));

  return (
    <div className="flex flex-col gap-3">
      <AppButton
        color="secondary"
        iconTrailing={open ? ChevronUp : ChevronDown}
        aria-expanded={open}
        aria-controls={panelId}
        onPress={() => setOpen((value) => !value)}
        className="self-start"
      >
        {active > 0 ? `Уточнить · ${active}` : "Уточнить"}
      </AppButton>
      <div id={panelId} hidden={!open} className="flex flex-col gap-3">
        {sections.length > 0 && (
          <>
            <p className={CAPTION}>Раздел</p>
            <TagGroup
              label="Раздел"
              selectionMode="single"
              disallowEmptySelection={false}
              size="lg"
              selectedKeys={section ? [section] : []}
              onSelectionChange={(selection) => onSectionChange(pick(selection)[0] ?? null)}
            >
              <TagList className="flex flex-wrap gap-2">
                {sections.map(({ code, label }) => (
                  <Tag key={code} id={code} className={CHIP}>
                    {label}
                  </Tag>
                ))}
              </TagList>
            </TagGroup>
          </>
        )}
        <p className={CAPTION}>Особенности состава</p>
        <TagGroup
          label="Особенности состава"
          selectionMode="multiple"
          size="lg"
          selectedKeys={selectedTags}
          onSelectionChange={(selection) => onTagsChange(tags.map(({ code }) => code).filter((code) => pick(selection).includes(code)))}
        >
          <TagList className="flex flex-wrap gap-2">
            {tags.map(({ code, label }) => (
              <Tag key={code} id={code} className={CHIP}>
                {label}
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      </div>
    </div>
  );
}
