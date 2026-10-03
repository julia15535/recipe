import { Great_Vibes, Manrope, Prata } from "next/font/google";

// Шрифты скачиваются при сборке и отдаются с нашего домена — посетитель к Google не обращается.
// Решение владельца 30.09: заголовки — Prata (с засечками, одно начертание 400), текст — Manrope;
// у обоих есть кириллица (ADR-0015).
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
const prata = Prata({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-prata", display: "swap" });
// Подпись «Юлианы» в логотипе (владелец 03.10, ADR-0033) — каллиграфия Great Vibes, кириллица есть.
const greatVibes = Great_Vibes({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-great-vibes", display: "swap" });

export const fontVariables = `${manrope.variable} ${prata.variable} ${greatVibes.variable}`;
