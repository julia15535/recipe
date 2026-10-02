// Сообщения экрана входа, когда новую попытку создать нельзя.
export const LOGIN_NOTICES = {
  limit: "Слишком много попыток входа. Подождите 10 минут и попробуйте снова.",
  unavailable: "Вход пока не настроен.",
} as const;
export type LoginNotice = keyof typeof LOGIN_NOTICES;
