// Округление пересчитанных количеств (план recipe-rounding, ADR-0026). Принцип — из USDA/NFSMI «Measuring
// Success with Standardized Recipes» (2002): умножить, перевести в удобную меру и округлить ДО БЛИЖАЙШЕЙ;
// шаги упрощены для домашней кухни. Яйца — King Arthur Baking (2020): 1 яйцо ≈ 50 г, часть — отвесить.
// Точное значение не меняется — округляется только показ; при коэффициенте ≠ 1 — значок ≈.
import { type Fraction, toNumber } from "./fraction";
import type { Quantity } from "./quantity";
import { formatAmount } from "./rescale";

export type Shown = { amount: string; unit: string | null; approx: boolean; hint: string | null };
type Line = { name: string; quantity: Quantity; unit: string | null; note: string | null };
type Part = { value: number; unit: string | null; text: string; hint?: string };

const EGG_GRAMS = 50;
const EGG_HINT = "слегка перемешайте яйца и отвесьте";
const NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const ONE_DECIMAL = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const GLYPHS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** «1¾», «½», «2» — для шагов в четверть и половину. */
function quarters(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const glyph = GLYPHS[Math.round((value - whole) * 4) / 4] ?? "";
  if (!glyph) return String(whole);
  return whole > 0 ? `${whole}${glyph}` : glyph;
}

type Kind = "weight" | "volume" | "tsp" | "tbsp" | "cup" | "egg" | "piece" | "fixed";

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

function weight(grams: number, base: "г" | "мл"): Part {
  const big = base === "г" ? "кг" : "л";
  const rounded = Math.max(1, Math.round(grams));
  if (rounded >= 1000) {
    const value = Math.round(grams / 10) / 100;
    return { value: value * 1000, unit: big, text: NUMBER.format(value) };
  }
  return { value: rounded, unit: base, text: String(rounded) };
}

function teaspoons(value: number): Part {
  if (value < 1 / 8) return { value, unit: null, text: "щепотка" };
  const q = Math.max(0.25, Math.round(value * 4) / 4);
  return { value: q, unit: "ч. л.", text: quarters(q) };
}

// Ст. л. — целыми и половинками (¼ ст. л. мерной ложкой не отмерить); дальше 15 % — в ч. л. до ¼.
function tablespoons(value: number): Part {
  const half = Math.round(value * 2) / 2;
  if (half < 0.5 || Math.abs(half - value) / value > 0.15) return teaspoons(value * 3);
  return { value: half, unit: "ст. л.", text: quarters(half) };
}

function cups(value: number, unit: string): Part {
  const q = Math.round(value * 4) / 4;
  if (q === 0) return tablespoons(value * 16);
  return { value: q, unit, text: quarters(q) };
}

function eggs(value: number, forceGrams: boolean): Part {
  const whole = Math.round(value);
  if (!forceGrams && whole >= 1 && Math.abs(whole - value) / value <= 0.15) return { value: whole, unit: "шт.", text: String(whole) };
  const grams = Math.max(5, Math.round((value * EGG_GRAMS) / 5) * 5);
  return { value: grams, unit: "г", text: String(grams), hint: EGG_HINT };
}

function pieces(value: number, unit: string | null): Part {
  const half = Math.round(value * 2) / 2;
  if (half > 0 && Math.abs(half - value) / value <= 0.25) return { value: half, unit, text: quarters(half) };
  const tenth = Math.max(0.1, Math.round(value * 10) / 10);
  return { value: tenth, unit, text: ONE_DECIMAL.format(tenth) };
}

function round(kind: Kind, value: number, unit: string | null, forceGrams = false): Part {
  switch (kind) {
    case "weight":
      return weight(unit === "кг" ? value * 1000 : value, "г");
    case "volume":
      return weight(unit === "л" ? value * 1000 : value, "мл");
    case "tsp":
      return teaspoons(value);
    case "tbsp":
      return tablespoons(value);
    case "cup":
      return cups(value, unit ?? "стак.");
    case "egg":
      return eggs(value, forceGrams);
    default:
      return pieces(value, unit);
  }
}

const isOne = (factor: Fraction) => factor.num === factor.den;

/**
 * Что показать в строке ингредиента после пересчёта. null — количества нет («по вкусу»): показывается пометка.
 * Коэффициент 1 — как в рецепте, без ≈; иначе — округление и ≈. Основной ингредиент сюда не попадает.
 */
export function showQuantity(line: Line, factor: Fraction): Shown | null {
  const { quantity, unit } = line;
  if (quantity.kind === "none") return null;
  const kind = kindOf(line);
  if (isOne(factor) || kind === "fixed") {
    const text =
      quantity.kind === "exact"
        ? formatAmount(quantity.amount, unit)
        : `${formatAmount(quantity.min, unit)}–${formatAmount(quantity.max, unit)}`;
    return { amount: text, unit, approx: false, hint: null };
  }
  const k = toNumber(factor);
  if (quantity.kind === "exact") {
    const part = round(kind, toNumber(quantity.amount) * k, unit);
    return { amount: part.text, unit: part.unit, approx: true, hint: part.hint ?? null };
  }
  const [lo, hi] = [toNumber(quantity.min) * k, toNumber(quantity.max) * k];
  let [min, max] = [round(kind, lo, unit), round(kind, hi, unit)];
  // Концы в разных единицах (яйца и граммы, ст. л. и ч. л., г и кг) — оба в более мелкой.
  if (min.unit !== max.unit) {
    if (kind === "egg") [min, max] = [round(kind, lo, unit, true), round(kind, hi, unit, true)];
    else if (kind === "weight" || kind === "volume") {
      const base = kind === "weight" ? "г" : "мл";
      const toBase = (v: number) => (unit === "кг" || unit === "л" ? v * 1000 : v);
      [min, max] = [toBase(lo), toBase(hi)].map((v) => ({ value: v, unit: base, text: String(Math.max(1, Math.round(v))) })) as [Part, Part];
    } else if (min.unit === null) {
      return { amount: `до ${max.text}`, unit: max.unit, approx: true, hint: null };
    } else {
      [min, max] = [teaspoons(lo * (kind === "tbsp" ? 3 : kind === "cup" ? 48 : 1)), teaspoons(hi * (kind === "tbsp" ? 3 : kind === "cup" ? 48 : 1))];
    }
  }
  const amount = min.text === max.text ? min.text : `${min.text}–${max.text}`;
  return { amount, unit: max.unit, approx: true, hint: max.hint ?? null };
}
