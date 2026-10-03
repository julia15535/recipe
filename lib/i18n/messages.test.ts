import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

// Ключи надписей ru и en совпадают (ADR-0029): пропущенный перевод — ошибка теста, а не пустое место на сайте.
const keys = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, inner]) => keys(inner, prefix ? `${prefix}.${key}` : key))
    : [prefix];

describe("надписи", () => {
  it("у русского и английского одинаковые ключи", () => {
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });
});
