import type { Metadata } from "next";
import { Suspense } from "react";

import { RecipeSearch } from "@/components/search/recipe-search";
import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { PrototypeBar } from "../_components/prototype-bar";
import { PROTOTYPE } from "../_demo/demo-catalog";
import { demoSearch } from "../_demo/demo-cards";
import { headerProps } from "../_demo/demo-selection";

export const metadata: Metadata = { title: "Поиск — пробный экран · Книга рецептов" };

// Тот же поиск, что на сайте (`components/search`), на примерных рецептах. Состояние — в адресе (чтение адреса
// в браузере, поэтому под Suspense).
export default async function SearchPrototypePage() {
  await requireOwner();
  return (
    <>
      <PrototypeBar />
      <SiteHeader {...headerProps()} />
      <Suspense>
        <RecipeSearch {...demoSearch()} homeHref={PROTOTYPE.home} />
      </Suspense>
    </>
  );
}
