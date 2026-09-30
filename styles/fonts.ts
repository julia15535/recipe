import { Manrope, Prata } from "next/font/google";

// Шрифты скачиваются при сборке и отдаются с нашего домена — посетитель к Google не обращается.
// Решение владельца 30.09: заголовки — Prata (с засечками, одно начертание 400), текст — Manrope;
// у обоих есть кириллица (ADR-0015).
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
const prata = Prata({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-prata", display: "swap" });

export const fontVariables = `${manrope.variable} ${prata.variable}`;
