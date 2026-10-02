// Тексты-образцы в тестах (Vite/Vitest `?raw`): файл как строка, без чтения диска из lib/domain.
declare module "*.txt?raw" {
  const text: string;
  export default text;
}
