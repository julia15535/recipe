import { Inter, Lora } from "next/font/google";

// Шрифты скачиваются при сборке и отдаются с нашего домена — посетитель к Google не обращается.
// Заголовки — Lora (с засечками), текст — Inter; обе с кириллицей (ADR-0015).
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const lora = Lora({ subsets: ["latin", "cyrillic"], variable: "--font-lora", display: "swap" });

export const fontVariables = `${inter.variable} ${lora.variable}`;
