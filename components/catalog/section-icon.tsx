import { createElement } from "react";
import {
  Amphora,
  CakeSlice,
  CookingPot,
  Croissant,
  CupSoda,
  Droplet,
  Drumstick,
  EggFried,
  type LucideIcon,
  Salad,
  Sandwich,
  Soup,
  Wheat,
} from "lucide-react";

// Иконки верхних разделов (ADR-0018) по стабильному id; раздел, добавленный из кабинета, получает общую.
const SECTION_ICONS: Record<string, LucideIcon> = {
  breakfast: EggFried,
  soups: Soup,
  salads: Salad,
  hot: Drumstick,
  sides: Wheat,
  starters: Sandwich,
  baking: Croissant,
  desserts: CakeSlice,
  sauces: Droplet,
  drinks: CupSoda,
  preserves: Amphora,
};

// Иконка раздела; createElement — иконка выбирается по id, а не создаётся компонентом при каждом рендере.
export function SectionIcon({ id, className }: { id: string; className?: string }) {
  return createElement(SECTION_ICONS[id] ?? CookingPot, { className, "aria-hidden": true });
}
