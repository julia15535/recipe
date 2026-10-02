import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { requireOwner } from "@/lib/server/auth/owner";

import { PrototypeBar } from "../../_components/prototype-bar";
import { RecipeGrid } from "../../_components/recipe-card";
import { PROTOTYPE, parseSectionId, sectionLabel } from "../../_demo/demo-catalog";
import { headerProps, recipesInSection } from "../../_demo/demo-selection";

// Прототип страницы раздела (владелец 01.10: «убери там поиск в начале, пусть сразу будут рецепты»):
// крошки, заголовок раздела и его рецепты; на сайте — `/{locale}/catalog/{slug}` (ADR-0017).
export async function generateMetadata({ params }: PageProps<"/admin/ui/section/[id]">): Promise<Metadata> {
  const id = parseSectionId((await params).id);
  return { title: `${id ? sectionLabel(id) : "Раздел"} — пробный экран · Книга рецептов` };
}

export default async function SectionPrototypePage({ params }: PageProps<"/admin/ui/section/[id]">) {
  await requireOwner();
  const id = parseSectionId((await params).id);
  if (!id) notFound();
  const recipes = recipesInSection(id);

  return (
    <>
      <PrototypeBar />
      <SiteHeader {...headerProps(id)} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-16 lg:px-8 lg:pt-8">
        <nav aria-label="Хлебные крошки">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
            <li>
              <NextLink href={PROTOTYPE.home} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                Главная
              </NextLink>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-secondary">
              {sectionLabel(id)}
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-display-sm text-primary lg:text-display-md">{sectionLabel(id)}</h1>
        {recipes.length > 0 ? (
          <section aria-labelledby="section-recipes">
            <h2 id="section-recipes" className="sr-only">
              Рецепты раздела
            </h2>
            <RecipeGrid recipes={recipes} />
          </section>
        ) : (
          <p className="text-lg text-tertiary">Пока нет рецептов — скоро появятся.</p>
        )}
      </main>
    </>
  );
}
