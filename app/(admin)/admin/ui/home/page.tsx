import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

import { HomeContent } from "../_components/home-content";
import { PrototypeBar } from "../_components/prototype-bar";
import { HEADER } from "../_demo/demo-catalog";

export const metadata: Metadata = { title: "Главная — пробный экран · Книга рецептов" };

// Прототип главной (решения владельца 01.10): поиск — лупой в шапке, первым — каталог, ниже —
// «Подборка недели» (выбирает владелец), «Популярное» — в самом низу и пока только как пример.
export default function HomePrototypePage() {
  return (
    <>
      <PrototypeBar demoSwitch />
      <SiteHeader {...HEADER} />
      <HomeContent />
    </>
  );
}
