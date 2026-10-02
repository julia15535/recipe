import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { HomeContent } from "../_components/home-content";
import { PrototypeBar } from "../_components/prototype-bar";
import { headerProps } from "../_demo/demo-selection";

export const metadata: Metadata = { title: "Главная — пробный экран · Книга рецептов" };

// Прототип главной (решения владельца 01.10): поиск — лупой в шапке, первым — каталог, ниже —
// «Подборка недели» (выбирает владелец), «Популярное» — в самом низу и пока только как пример.
export default async function HomePrototypePage() {
  await requireOwner();
  return (
    <>
      <PrototypeBar />
      <SiteHeader {...headerProps()} />
      <HomeContent />
    </>
  );
}
