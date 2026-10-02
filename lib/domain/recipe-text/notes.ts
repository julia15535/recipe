// Пометка ингредиента без примерного веса/объёма (владелец 02.10: «если и ложки, и граммы в скобках —
// только ложки»): «1 ч. л. (примерно 3 г)» → «1 ч. л.». Граммы в пометке не пересчитываются, и после
// пересчёта вышло бы «2 ч. л., примерно 3 г». Если количества нет («на кончике ножа, примерно 1 г») — не трогаем.
import type { Quantity } from "../quantity";

const NUM = String.raw`\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?`;
const WEIGHT = new RegExp(
  String.raw`^(?:примерно|прибл\.?|около|≈|~)?\s*${NUM}(?:\s*[–—-]\s*${NUM})?\s*(?:г|гр|грамм\S*|кг|мл|л)\.?(?:\s*\/\s*.+)?$`,
  "i",
);

export function withoutWeight(note: string | null, quantity: Quantity): string | null {
  if (!note || quantity.kind === "none") return note;
  const kept = note
    .split(/\s*[,;]\s*/)
    .filter((part) => part && !WEIGHT.test(part.trim()))
    .join(", ");
  return kept || null;
}
