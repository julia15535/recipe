"use client";

import { FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ArticleBody } from "@/components/article/article-body";
import { AppButton } from "@/components/app-button";

import { SaveButtons } from "../../recipes/_components/save-buttons";
import { type ArticleParsed, parseArticleText, saveArticle } from "../actions";
import { ArticleChecks } from "./article-checks";
import { ArticleFields } from "./article-fields";

type Props = { initialTitle?: string; initialText?: string; article?: { id: string; revision: number }; aiEnabled: boolean };
const OFFLINE = "Нет связи с сайтом — проверьте интернет и нажмите ещё раз. Текст на месте.";

// Новая статья и правка (план articles): название + текст как есть → «Разобрать» (ИИ отмечает заголовки, абзацы,
// списки) или «Разобрать без ИИ» → «Проверьте» и предпросмотр → сохранить. Перенесли метку фото, слова те же —
// сервер переносит прежнюю разметку без ИИ.
export function ArticleEditor({ initialTitle = "", initialText = "", article, aiEnabled }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);
  const [parsed, setParsed] = useState<Extract<ArticleParsed, { ok: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [offerPlain, setOfferPlain] = useState(!aiEnabled);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<void>) =>
    start(async () => {
      setMessage(null);
      try {
        await work();
      } catch {
        setMessage(OFFLINE);
        setOfferPlain(true);
      }
    });
  const parse = (ai: boolean) =>
    run(async () => {
      const result = await parseArticleText({ title, text, articleId: article?.id ?? null, ai });
      if (!result.ok) {
        setMessage(result.message);
        setOfferPlain(true);
        return;
      }
      setParsed(result);
      window.scrollTo({ top: 0 });
    });
  const save = (publish: boolean) =>
    run(async () => {
      if (!parsed) return;
      const result = await saveArticle({ importId: parsed.importId, title, publish, target: article ?? null });
      if (result.ok) router.push(`/admin/articles/${result.id}`);
      else setMessage(result.message);
    });

  const alert = message && (
    <p role="alert" className="rounded-xl bg-accent-50 p-4 text-md text-primary">
      {message}
    </p>
  );
  const empty = text.trim() === "";

  if (!parsed) {
    return (
      <div className="flex flex-col gap-4">
        {alert}
        <ArticleFields title={title} text={text} onTitle={setTitle} onText={setText} />
        <div className="flex flex-wrap gap-3">
          {aiEnabled && (
            <AppButton iconLeading={Sparkles} onPress={() => parse(true)} isDisabled={pending || empty}>
              {pending ? "Размечаю…" : message ? "Разобрать ещё раз" : "Разобрать"}
            </AppButton>
          )}
          {offerPlain && (
            <AppButton color="secondary" iconLeading={FileText} onPress={() => parse(false)} isDisabled={pending || empty}>
              Разобрать без ИИ
            </AppButton>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ArticleChecks issues={parsed.issues} ready={parsed.ready} />
      {alert}
      <SaveButtons editing={Boolean(article)} ready={parsed.ready} pending={pending} onBack={() => setParsed(null)} onSave={save} />
      <section aria-label="Так статья будет выглядеть на сайте" className="-mx-4 rounded-2xl bg-page py-6 ring-1 ring-secondary">
        <ArticleBody view={parsed.view} recipesLabel="Рецепты из статьи" missingPhoto={(key) => <p className="rounded-xl bg-secondary p-4 text-md text-tertiary">Место фото «{key}»</p>} />
      </section>
    </div>
  );
}
