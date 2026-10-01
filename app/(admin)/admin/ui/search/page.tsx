import type { Metadata } from "next";
import { Suspense } from "react";

import { PrototypeBar } from "../_components/prototype-bar";
import { SearchPrototype } from "../_components/search-prototype";

export const metadata: Metadata = { title: "Поиск — пробный экран · Книга рецептов" };

// Раздел приходит в адресе (?section=…) — чтение адреса в браузере, поэтому под Suspense.
export default function SearchPrototypePage() {
  return (
    <>
      <PrototypeBar demoSwitch />
      <Suspense>
        <SearchPrototype />
      </Suspense>
    </>
  );
}
