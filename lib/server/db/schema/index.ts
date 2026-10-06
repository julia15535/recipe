// Схема Drizzle — единственный источник типов БД (ADR-0012). Файл не импортирует server-only:
// его читает drizzle-kit в обычном Node.
export * from "./auth";
export * from "./catalog";
export * from "./recipe-rows";
export * from "./recipes";
export * from "./photos";
export * from "./translations";
export * from "./articles";
