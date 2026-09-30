import { Alegreya, Literata } from "next/font/google";

// Шрифты-кандидаты для заголовков — грузятся только на пробной странице (Lora — общий, styles/fonts.ts).
const literata = Literata({ subsets: ["latin", "cyrillic"], variable: "--font-literata", display: "swap" });
const alegreya = Alegreya({ subsets: ["latin", "cyrillic"], variable: "--font-alegreya", display: "swap" });

export const candidateFontVariables = `${literata.variable} ${alegreya.variable}`;
