// Перевод статей против живой БД (pnpm db:up): `pnpm test:db`. ИИ — подставной «переводчик» (EN перед текстами).
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { insertMarker, lastLineOf, remap } from "@/lib/domain/article-text/edit";
import { normalizeText } from "@/lib/domain/article-text/lines";
import { parseArticle } from "@/lib/domain/article-text/parse";
import { type ArticleSource, articleUnits, composeArticle } from "@/lib/domain/article-text/translation";
import { fullCrop } from "@/lib/domain/photo";
import { getDb, getSql } from "@/lib/server/db/client";
import { articles, articleTranslationJobs } from "@/lib/server/db/schema";
import type { AiConfig } from "@/lib/server/env";
import { normalize, renderCrop } from "@/lib/server/media/process";

import { addArticlePhoto, setPhotoCaption } from "./photos";
import { readArticleCards, readPublicArticle } from "./public";
import { getArticle } from "./queries";
import { createArticle, replaceArticle, setArticleRecipes, setArticleStatus } from "./save";
import { ARTICLE_MAX_ATTEMPTS, claimArticleJob, enqueueArticleTranslation, finishArticleJob, releaseArticleJob } from "./translation-jobs";
import { articleTranslationState, failExhaustedArticles, neverTranslated, pendingArticleWork } from "./translation-queue";
import { runArticleJob } from "./translation-run";

const enabled = process.env.RECIPE_DB_TESTS === "1";
const created: string[] = [];
const marker = randomUUID().slice(0, 8);
const config = { apiKey: "test", baseUrl: "http://127.0.0.1:9", model: "test/model" } as AiConfig;
const TEXT = normalizeText("Вафли можно подать **по-разному** при 180 °C.\n\n# С рыбой\n- *сыр*\n- рыба");

/** Подставной переводчик: «EN » перед каждым текстом, метки оформления на месте — как настоящий, через composeArticle. */
const fake = (prefix: string) => async (source: ArticleSource) => {
  const composed = composeArticle(source, articleUnits(source).map((unit) => ({ id: unit.id, text: `${prefix} ${unit.text}` })));
  return composed.ok ? { ok: true as const, article: composed.article, model: "test/model", promptVersion: "test" } : composed;
};
const failing = async () => ({ ok: false as const, reason: "server" as const });

async function article(title: string, status: "draft" | "published" = "published") {
  const saved = await createArticle({ title, sourceText: TEXT, body: parseArticle(TEXT, null).body }, status);
  if (!saved.ok) throw new Error("статья не сохранилась");
  created.push(saved.id);
  return saved.id;
}

type Translator = NonNullable<NonNullable<Parameters<typeof runArticleJob>[1]>["translate"]>;

async function translate(articleId: string, force: boolean, translator: Translator = fake("EN")) {
  const job = await enqueueArticleTranslation(articleId, force);
  if (job) await runArticleJob(job, { translate: translator, config });
  return job;
}

describe.skipIf(!enabled)("перевод статей: БД", () => {
  afterAll(async () => {
    await getDb().delete(articles).where(inArray(articles.id, created));
    await getSql().end({ timeout: 5 });
  });

  it("перевод → /en: список, статья (оформление, структура, подпись фото), пара RU/EN; черновика нет", async () => {
    const id = await article(`Вафли ${marker}`);
    expect(await articleTranslationState(id)).toEqual({ slug: null, outdated: false, job: null });
    const stored = await getArticle(id);
    if (!stored) throw new Error("нет статьи");
    const sourceText = insertMarker(stored.sourceText, lastLineOf(stored.body, "b1") ?? -1, "Q7K2");
    const moved = remap(stored.sourceText, stored.body, sourceText);
    if (!moved.ok) throw new Error("метка не легла");
    const input = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c96" } }).jpeg().toBuffer();
    const source = await normalize(input);
    const crop = fullCrop(source.size);
    await addArticlePhoto(id, 1, "Q7K2", { size: source.size, crop, files: [source.file, ...(await renderCrop(source.file.bytes, crop))] }, { sourceText, body: moved.body });
    await setPhotoCaption(id, "Q7K2", "Вафли *с рыбой*");

    await translate(id, false);
    const state = await articleTranslationState(id);
    expect(state).toMatchObject({ outdated: false, job: { status: "done" } });
    expect(state.slug).toMatch(/^en-vafli-/);
    const page = await readPublicArticle("en", state.slug ?? "");
    expect(page?.view.title).toBe(`EN Вафли ${marker}`);
    expect(page?.view.blocks.map((block) => block.type)).toEqual(["paragraph", "photo", "heading", "list"]);
    expect(page?.view.blocks[0]).toMatchObject({ text: "EN Вафли можно подать **по-разному** при 180 °C." });
    expect(page?.view.blocks[3]).toMatchObject({ type: "list", items: [{ text: "EN *сыр*" }, { text: "EN рыба" }] });
    expect(page?.view.photos.Q7K2).toMatchObject({ caption: "EN Вафли с рыбой", alt: "EN Вафли с рыбой" });
    expect(page?.excerpt).toBe("EN Вафли можно подать по-разному при 180 °C.");
    expect(page?.otherSlug).toBe(stored.slug);
    expect((await readPublicArticle("ru", stored.slug))?.otherSlug).toBe(state.slug);
    expect((await readArticleCards("en")).map((card) => card.id)).toContain(id);

    const draft = await article(`Черновик ${marker}`, "draft");
    expect(await translate(draft, true)).toBeNull(); // черновик не переводим
    await setArticleStatus(id, "draft");
    expect(await readPublicArticle("en", state.slug ?? "")).toBeNull();
    expect((await readArticleCards("en")).map((card) => card.id)).not.toContain(id);
    expect((await readArticleCards("en")).map((card) => card.id)).not.toContain(draft);
  });

  it("«устарел» — от текста и подписи, не от связей; без force не переводится; заново — тот же адрес; сбой — прежний перевод", async () => {
    const id = await article(`Блины ${marker}`);
    await translate(id, false);
    const { slug } = await articleTranslationState(id);
    expect(await translate(id, false)).toBeNull();
    const revision = async () => (await getArticle(id))?.revision ?? 0;
    await setArticleRecipes(id, await revision(), []);
    expect(await articleTranslationState(id)).toMatchObject({ slug, outdated: false });
    const changed = normalizeText(`${TEXT}\n\nЕщё абзац.`);
    expect((await replaceArticle(id, await revision(), { title: `Блины ${marker}`, sourceText: changed, body: parseArticle(changed, null).body })).ok).toBe(true);
    expect(await articleTranslationState(id)).toMatchObject({ slug, outdated: true });
    await translate(id, true, failing);
    expect(await articleTranslationState(id)).toMatchObject({ slug, outdated: true, job: { status: "failed", error: "server" } });
    expect((await readPublicArticle("en", slug ?? ""))?.view.blocks).toHaveLength(3);
    await translate(id, true, fake("EN2"));
    expect(await articleTranslationState(id)).toMatchObject({ slug, outdated: false });
    expect((await readPublicArticle("en", slug ?? ""))?.view.blocks).toHaveLength(4);
  });

  it("поздний результат чужого задания ничего не пишет; статья без заданий — в «перевести раз в жизни»; удаление — каскадом", async () => {
    const id = await article(`Сырники ${marker}`);
    expect(await neverTranslated(1000)).toContain(id);
    const job = await enqueueArticleTranslation(id, false);
    if (!job) throw new Error("нет задания");
    expect(await neverTranslated(1000)).not.toContain(id);
    const claimed = await claimArticleJob(job);
    if (!claimed) throw new Error("не взяли");
    const result = await fake("EN")(claimed.input as ArticleSource);
    if (!result.ok) throw new Error("перевод не собрался");
    expect(await finishArticleJob(job, randomUUID(), id, { article: result.article, sourceContentRevision: 1, model: "m", promptVersion: "v" })).toBe(false);
    expect(await articleTranslationState(id)).toMatchObject({ slug: null });
    await getDb().delete(articles).where(eq(articles.id, id));
    expect(await getDb().select().from(articleTranslationJobs).where(eq(articleTranslationJobs.articleId, id))).toEqual([]);
  });

  it("аренда: занятое не взять, истёкшую — взять снова; «отдать» не тратит попытку; после 3 захватов — «не удалось»", async () => {
    const id = await article(`Оладьи ${marker}`);
    const job = await enqueueArticleTranslation(id, false);
    if (!job) throw new Error("нет задания");
    const expire = () => getDb().update(articleTranslationJobs).set({ leaseUntil: sql`now() - interval '1 second'` }).where(eq(articleTranslationJobs.id, job));
    const first = await claimArticleJob(job);
    expect(first).not.toBeNull();
    expect(await claimArticleJob(job)).toBeNull();
    await releaseArticleJob(job, first?.token ?? "");
    for (let attempt = 1; attempt <= ARTICLE_MAX_ATTEMPTS; attempt += 1) {
      expect(await claimArticleJob(job), `захват ${attempt}`).not.toBeNull();
      await expire();
      if (attempt < ARTICLE_MAX_ATTEMPTS) expect((await pendingArticleWork()).run.length).toBeGreaterThan(0); // истёкшую видит подборщик
    }
    expect(await claimArticleJob(job)).toBeNull();
    await failExhaustedArticles();
    expect(await articleTranslationState(id)).toMatchObject({ slug: null, job: { status: "failed", error: "lease" } });
  });
});

