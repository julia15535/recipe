import { CatalogRibbon } from "./catalog-ribbon";
import { CatalogSheet } from "./catalog-sheet";
import type { CatalogSection } from "./types";

// Каталог — первое, что видно на главной (решение владельца 01.10): на компьютере — лента, на телефоне
// и планшете — кнопка «Каталог» с нижним листом. Граница — lg (1024 px): уже 11 разделов в ленту не влезают.
type Props = { sections: CatalogSection[]; labels: { catalog: string; close: string } };

export function CatalogNav({ sections, labels }: Props) {
  return (
    <>
      <CatalogRibbon sections={sections} label={labels.catalog} className="max-lg:hidden" />
      <CatalogSheet sections={sections} label={labels.catalog} closeLabel={labels.close} className="px-4 lg:hidden" />
    </>
  );
}
