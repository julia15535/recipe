import { describe, expect, it } from "vitest";

import { redact } from "./log";

describe("redact", () => {
  it("прячет значения секретных ключей на любой глубине", () => {
    expect(redact({ user: { token: "abc", password: "p" }, authorization: "Bearer x" })).toEqual({
      user: { token: "[redacted]", password: "[redacted]" },
      authorization: "[redacted]",
    });
  });

  it("оставляет от телефона только две последние цифры", () => {
    expect(redact({ phone: "+7 (913) 123-45-67" })).toEqual({ phone: "***67" });
  });

  it("находит телефон внутри произвольной строки", () => {
    expect(redact({ msg: "код отправлен на +79131234567" })).toEqual({ msg: "код отправлен на ***67" });
  });

  it("не пишет текст импорта рецепта, только его длину", () => {
    expect(redact({ importText: "Сырники: творог 500 г" })).toEqual({ importText: "[text len=21]" });
  });

  it("прячет всё, что относится ко входу владельца", () => {
    const fields = { challenge: "c", bindingHash: "b", nonce: "n", code: "4821", state: "s", update: { text: "/start x" } };
    expect(redact(fields)).toEqual({
      challenge: "[redacted]",
      bindingHash: "[redacted]",
      nonce: "[redacted]",
      code: "[redacted]",
      state: "[redacted]",
      update: "[redacted]",
    });
  });

  it("не трогает обычные поля", () => {
    expect(redact({ requestId: "r-1", status: 200, ok: true })).toEqual({ requestId: "r-1", status: 200, ok: true });
  });
});
