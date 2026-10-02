// Что бот отвечает владельцу и посторонним. Чистый модуль: тексты и вызовы Bot API как данные.

type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

export type BotCall =
  | { method: "sendMessage"; params: { chat_id: number; text: string; reply_markup?: InlineKeyboard } }
  | { method: "editMessageText"; params: { chat_id: number; message_id: number; text: string } }
  | { method: "answerCallbackQuery"; params: { callback_query_id: string; text?: string } };

export const BOT_TEXT = {
  confirm: (code: string) =>
    `Вход в кабинет «Книги рецептов».\nКод: ${code}\n\n` +
    "Нажмите «Подтвердить», только если этот же код сейчас виден у вас на экране входа.",
  confirmed: (code: string) => `Вход подтверждён (код ${code}). Вернитесь на сайт — кабинет откроется сам.`,
  rejected: "Вход отменён. Без вашего подтверждения войти в кабинет нельзя.",
  expired: (siteUrl: string) => `Эта ссылка для входа устарела. Откройте вход на сайте заново: ${siteUrl}/admin/login`,
  help: (siteUrl: string) =>
    `Это бот для входа в кабинет «Книги рецептов». Чтобы войти, откройте ${siteUrl}/admin/login ` +
    "и нажмите «Войти через Telegram».",
  foreign: (siteUrl: string) => `Это личный бот «Книги рецептов». Рецепты — на сайте ${siteUrl}`,
};

/** Кнопки под запросом входа; в callback_data — id вызова, а не сам challenge. */
export function confirmKeyboard(challengeId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "Подтвердить", callback_data: `ok:${challengeId}` }],
      [{ text: "Это не я", callback_data: `no:${challengeId}` }],
    ],
  };
}

export function send(chatId: number, text: string, replyMarkup?: InlineKeyboard): BotCall {
  return { method: "sendMessage", params: { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) } };
}

export function edit(chatId: number, messageId: number, text: string): BotCall {
  return { method: "editMessageText", params: { chat_id: chatId, message_id: messageId, text } };
}

export function answer(callbackQueryId: string, text?: string): BotCall {
  return { method: "answerCallbackQuery", params: { callback_query_id: callbackQueryId, ...(text ? { text } : {}) } };
}
