// Раздел каталога для навигации (ADR-0018). Адрес готовит вызывающий: прототип или публичная страница
// (адрес раздела по ADR-0017 — `/{locale}/catalog/{slug}`, появится со схемой БД).
export type CatalogSection = { id: string; label: string; href: string };
