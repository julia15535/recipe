import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";

import { PrototypeBar } from "../_components/prototype-bar";
import { SearchPrototype } from "../_components/search-prototype";
import { HEADER } from "../_demo/demo-catalog";

export const metadata: Metadata = { title: "Поиск — пробный экран · Книга рецептов" };

// Раздел приходит в адресе (?section=…) — чтение адреса в браузере, поэтому под Suspense.
export default function SearchPrototypePage() {
  return (
    <>
      <PrototypeBar />
      <SiteHeader {...HEADER} />
      <Suspense>
        <SearchPrototype />
      </Suspense>
    </>
  );
}
