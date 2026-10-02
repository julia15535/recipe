import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { PrototypeBar } from "../_components/prototype-bar";
import { SearchPrototype } from "../_components/search-prototype";
import { headerProps } from "../_demo/demo-selection";

export const metadata: Metadata = { title: "Поиск — пробный экран · Книга рецептов" };

// Раздел приходит в адресе (?section=…) — чтение адреса в браузере, поэтому под Suspense.
export default async function SearchPrototypePage() {
  await requireOwner();
  return (
    <>
      <PrototypeBar />
      <SiteHeader {...headerProps()} />
      <Suspense>
        <SearchPrototype />
      </Suspense>
    </>
  );
}
