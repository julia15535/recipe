// Округление пересчитанных количеств (план recipe-rounding, ADR-0026). Принцип — из USDA/NFSMI «Measuring
// Success with Standardized Recipes» (2002): умножить, перевести в удобную меру и округлить ДО БЛИЖАЙШЕЙ;
// шаги упрощены для домашней кухни. Яйца — King Arthur Baking (2020): 1 яйцо ≈ 50 г, часть — отвесить.
// Точное значение не меняется — округляется только показ; при коэффициенте ≠ 1 — значок ≈. Слова («щепотка», «до»,
// подсказка про яйца) — кодами: их подставляет интерфейс на языке страницы (ADR-0029).
import { type Fraction, toNumber } from "./fraction";
import { type Lang, perLang } from "./lang";
import type { Quantity } from "./quantity";
import { formatAmount } from "./rescale";

/** `special`: pinch — «щепотка» без числа; upTo — «до {amount}». `hint`: weighEggs — «слегка перемешайте яйца и отвесьте». */
export type Shown = { amount: string; unit: string | null; approx: boolean; hint: "weighEggs" | null; special: "pinch" | "upTo" | null };
type Line = { name: string; quantity: Quantity; unit: string | null; note: string | null };
type Part = { value: number; unit: string | null; text: string; pinch?: boolean; hint?: "weighEggs" };

const EGG_GRAMS = 50;
// Стакан — 250 мл, ст. л. — 15, ч. л. — 5 (так подписано и в английской версии: «cup ≈ 250 ml»).
const TBSP_PER_CUP = 250 / 15;
const TSP_PER_CUP = 250 / 5;
const NUMBER = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }));
const ONE_DECIMAL = perLang((locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }));

/** «1,75», «0,5», «2» — шаги в четверть и половину десятичной записью (владелец 03.10). */
const quarters = (value: number, lang: Lang): string => NUMBER(lang).format(Math.round(value * 4) / 4);

export const KINDS = ["weight", "volume", "tsp", "tbsp", "cup", "egg", "piece", "fixed"] as const;
export type Kind = (typeof KINDS)[number];

/** Тип строки: сначала единица, потом название (яйца — только «яйцо/яйца» в штуках). */
export function kindOf({ name, unit, note }: Pick<Line, "name" | "unit" | "note">): Kind {
  const text = `${name} ${note ?? ""}`.toLowerCase();
  if (/смаз/.test(text)) return "fixed";
  const u = (unit ?? "").toLowerCase();
  if (u === "г" || u === "кг") return "weight";
  if (u === "мл" || u === "л") return "volume";
  if (u === "ч. л.") return "tsp";
  if (u === "ст. л.") return "tbsp";
  if (u.startsWith("стак")) return "cup";
  const egg = /(^|[^а-яё])яй(цо|ца|ц)([^а-яё]|$)/i.test(name) && !/желт|белок|белк|порош|сух|перепел/i.test(name);
  if (egg && (u === "" || u === "шт.")) return "egg";
  return "piece";
}

function weight(grams: number, base: "г" | "мл", lang: Lang): Part {
  const big = base === "г" ? "кг" : "л";
  const rounded = Math.max(1, Math.round(grams));
  if (rounded >= 1000) {
    const value = Math.round(grams / 10) / 100;
    return { value: value * 1000, unit: big, text: NUMBER(lang).format(value) };
  }
  return { value: rounded, unit: base, text: String(rounded) };
}

function teaspoons(value: number, lang: Lang): Part {
  if (value < 1 / 8) return { value, unit: null, text: "", pinch: true };
  const q = Math.max(0.25, Math.round(value * 4) / 4);
  return { value: q, unit: "ч. л.", text: quarters(q, lang) };
}

// Ст. л. — целыми и половинками (¼ ст. л. мерной ложкой не отмерить); дальше 15 % — в ч. л. до ¼.
function tablespoons(value: number, lang: Lang): Part {
  const half = Math.round(value * 2) / 2;
  if (half < 0.5 || Math.abs(half - value) / value > 0.15) return teaspoons(value * 3, lang);
  return { value: half, unit: "ст. л.", text: quarters(half, lang) };
}

function cups(value: number, unit: string, lang: Lang): Part {
  const q = Math.round(value * 4) / 4;
  if (q === 0) return tablespoons(value * TBSP_PER_CUP, lang);
  return { value: q, unit, text: quarters(q, lang) };
}

function eggs(value: number, forceGrams: boolean): Part {
  const whole = Math.round(value);
  if (!forceGrams && whole >= 1 && Math.abs(whole - value) / value <= 0.15) return { value: whole, unit: "шт.", text: String(whole) };
  const grams = Math.max(5, Math.round((value * EGG_GRAMS) / 5) * 5);
  return { value: grams, unit: "г", text: String(grams), hint: "weighEggs" };
}

function pieces(value: number, unit: string | null, lang: Lang): Part {
  const half = Math.round(value * 2) / 2;
  if (half > 0 && Math.abs(half - value) / value <= 0.25) return { value: half, unit, text: quarters(half, lang) };
  const tenth = Math.max(0.1, Math.round(value * 10) / 10);
  return { value: tenth, unit, text: ONE_DECIMAL(lang).format(tenth) };
}

function round(kind: Kind, value: number, unit: string | null, lang: Lang, forceGrams = false): Part {
  switch (kind) {
    case "weight":
      return weight(unit === "кг" ? value * 1000 : value, "г", lang);
    case "volume":
      return weight(unit === "л" ? value * 1000 : value, "мл", lang);
    case "tsp":
      return teaspoons(value, lang);
    case "tbsp":
      return tablespoons(value, lang);
    case "cup":
      return cups(value, unit ?? "стак.", lang);
    case "egg":
      return eggs(value, forceGrams);
    default:
      return pieces(value, unit, lang);
  }
}

const isOne = (factor: Fraction) => factor.num === factor.den;

type Options = { lang?: Lang; kind?: Kind };

/**
 * Что показать в строке ингредиента после пересчёта. null — количества нет («по вкусу»): показывается пометка.
 * Коэффициент 1 — как в рецепте, без ≈; иначе — округление и ≈. Основной ингредиент сюда не попадает.
 * `kind` — из перевода (вид строки определён по русской строке при переводе), иначе — по самой строке.
 */
export function showQuantity(line: Line, factor: Fraction, { lang = "ru", kind = kindOf(line) }: Options = {}): Shown | null {
  const { quantity, unit } = line;
  if (quantity.kind === "none") return null;
  if (isOne(factor) || kind === "fixed") {
    const text =
      quantity.kind === "exact"
        ? formatAmount(quantity.amount, lang)
        : `${formatAmount(quantity.min, lang)}–${formatAmount(quantity.max, lang)}`;
    return { amount: text, unit, approx: false, hint: null, special: null };
  }
  const k = toNumber(factor);
  if (quantity.kind === "exact") {
    const part = round(kind, toNumber(quantity.amount) * k, unit, lang);
    return { amount: part.text, unit: part.unit, approx: true, hint: part.hint ?? null, special: part.pinch ? "pinch" : null };
  }
  const [lo, hi] = [toNumber(quantity.min) * k, toNumber(quantity.max) * k];
  let [min, max] = [round(kind, lo, unit, lang), round(kind, hi, unit, lang)];
  // Концы в разных единицах (яйца и граммы, ст. л. и ч. л., г и кг) — оба в более мелкой.
  if (min.unit !== max.unit) {
    if (kind === "egg") [min, max] = [round(kind, lo, unit, lang, true), round(kind, hi, unit, lang, true)];
    else if (kind === "weight" || kind === "volume") {
      const base = kind === "weight" ? "г" : "мл";
      const toBase = (v: number) => (unit === "кг" || unit === "л" ? v * 1000 : v);
      [min, max] = [toBase(lo), toBase(hi)].map((v) => ({ value: v, unit: base, text: String(Math.max(1, Math.round(v))) })) as [Part, Part];
    } else if (min.unit === null) {
      return { amount: max.text, unit: max.unit, approx: true, hint: null, special: "upTo" };
    } else {
      const perTsp = kind === "tbsp" ? 3 : kind === "cup" ? TSP_PER_CUP : 1;
      [min, max] = [teaspoons(lo * perTsp, lang), teaspoons(hi * perTsp, lang)];
    }
  }
  const amount = min.text === max.text ? min.text : `${min.text}–${max.text}`;
  return { amount, unit: max.unit, approx: true, hint: max.hint ?? null, special: max.pinch ? "pinch" : null };
}
