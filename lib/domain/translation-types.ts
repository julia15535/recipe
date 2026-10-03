// Типы перевода рецепта (ADR-0029): вход задания (снимок русского), ответ ИИ (только тексты), готовый снимок.
import type { Fraction } from "./fraction";
import type { Quantity } from "./quantity";
import type { Kind } from "./rounding";

export const TRANSLATION_SCHEMA_VERSION = 1;

type Row = { id: string; text: string };
export type SourceIngredient = { id: string; name: string; note: string | null; quantity: Quantity; unit: string | null; kind: Kind };
/** Русский рецепт на момент постановки перевода (вход задания). */
export type SourceRecipe = {
  schemaVersion: number;
  title: string;
  description: string | null;
  time: string | null;
  yield: { amount: Fraction; forms: readonly string[] } | null;
  sectionCodes: string[];
  primarySectionCode: string;
  tagCodes: string[];
  mainId: string | null;
  ingredients: SourceIngredient[];
  steps: Row[];
  tips: Row[];
};

/** Ответ ИИ — только тексты (с метками чисел). */
export type AiTranslation = {
  title: string;
  description: string | null;
  time: string | null;
  yieldForms: [one: string, other: string] | null;
  ingredients: { id: string; name: string; note: string | null; unitForms: [one: string, other: string] | null }[];
  steps: Row[];
  tips: Row[];
};

/** Готовый снимок перевода (всё, кроме названия, описания, времени и форм выхода — они в локализации). */
export type TranslationBody = {
  schemaVersion: number;
  yield: Fraction | null;
  sectionCodes: string[];
  primarySectionCode: string;
  tagCodes: string[];
  mainId: string | null;
  ingredients: (Omit<SourceIngredient, "name" | "note"> & { name: string; note: string | null; unitForms: [string, string] | null })[];
  steps: Row[];
  tips: Row[];
};
export type TranslationHead = { title: string; description: string | null; time: string | null; yieldForms: [string, string] | null };

export type ComposeResult = { ok: true; head: TranslationHead; body: TranslationBody } | { ok: false; reason: "structure" | "numbers" };

