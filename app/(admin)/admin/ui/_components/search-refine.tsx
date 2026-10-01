"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import type { Selection } from "react-aria-components";

import { AppButton } from "@/components/app-button";
import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";

import { COMPOSITION_TAGS, type CompositionTag, SECTIONS, type SectionId, parseSectionId } from "../_demo/demo-catalog";

const CHIP = "min-h-11 rounded-full px-4 text-md";
const CAPTION = "text-sm font-semibold text-secondary";

type Props = {
  section: SectionId | null;
  onSectionChange: (section: SectionId | null) => void;
  tags: CompositionTag[];
  onTagsChange: (tags: CompositionTag[]) => void;
};

// Уточнение без сложной формы (ADR-0002): раздел (один, можно снять) и теги состава (ADR-0019).
// На телефоне 16 «таблеток» не должны стоять перед результатами — спрятаны за «Уточнить»; если
// уточнение уже выбрано (пришли из каталога), блок открыт сразу.
export function SearchRefine({ section, onSectionChange, tags, onTagsChange }: Props) {
  const [open, setOpen] = useState(section !== null || tags.length > 0);
  const panelId = useId();
  const active = (section ? 1 : 0) + tags.length;

  const pickSection = (selection: Selection) => {
    const [next] = selection === "all" ? [] : [...selection];
    onSectionChange(parseSectionId(next));
  };
  const pickTags = (selection: Selection) =>
    onTagsChange(selection === "all" ? [] : COMPOSITION_TAGS.filter((tag) => selection.has(tag)));

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
        <p className={CAPTION}>Раздел</p>
        <TagGroup
          label="Раздел"
          selectionMode="single"
          disallowEmptySelection={false}
          size="lg"
          selectedKeys={section ? [section] : []}
          onSelectionChange={pickSection}
        >
          <TagList className="flex flex-wrap gap-2">
            {SECTIONS.map(({ id, label }) => (
              <Tag key={id} id={id} className={CHIP}>
                {label}
              </Tag>
            ))}
          </TagList>
        </TagGroup>
        <p className={CAPTION}>Особенности состава</p>
        <TagGroup label="Особенности состава" selectionMode="multiple" size="lg" selectedKeys={tags} onSelectionChange={pickTags}>
          <TagList className="flex flex-wrap gap-2">
            {COMPOSITION_TAGS.map((tag) => (
              <Tag key={tag} id={tag} className={CHIP}>
                {tag}
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      </div>
    </div>
  );
}
