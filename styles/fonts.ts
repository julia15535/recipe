import { Inter, Jost } from "next/font/google";

// Шрифты скачиваются при сборке и отдаются с нашего домена — посетитель к Google не обращается.
// Заголовки — Jost (дружелюбный геометрический), текст — Inter; обе с кириллицей (ADR-0015).
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const jost = Jost({ subsets: ["latin", "cyrillic"], variable: "--font-jost", display: "swap" });

export const fontVariables = `${inter.variable} ${jost.variable}`;
