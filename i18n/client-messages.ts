import "server-only";
import { getMessages } from "next-intl/server";

// Клиенту — только надписи клиентских компонентов (рецепт, поиск, каталог, ошибка), а не весь словарь: он растёт
// с каждой страницей. Кабинет получает те же разделы по-русски — общие компоненты рецепта работают и там.
const CLIENT_NAMESPACES = ["Recipe", "Search", "Catalog", "Error"] as const;

export async function clientMessages(): Promise<Record<string, unknown>> {
  const all = await getMessages();
  return Object.fromEntries(CLIENT_NAMESPACES.map((name) => [name, all[name]]));
}
