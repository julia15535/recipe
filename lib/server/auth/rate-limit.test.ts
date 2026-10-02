import { describe, expect, it } from "vitest";

import { allow, ipKey } from "./rate-limit";

describe("ограничение частоты в памяти", () => {
  it("пропускает limit запросов за окно, дальше — отказ; после окна — снова можно", () => {
    const key = `test:${Math.random()}`;
    expect([0, 1, 2].map((i) => allow(key, 2, 1000, 10_000 + i))).toEqual([true, true, false]);
    expect(allow(key, 2, 1000, 11_500)).toBe(true);
  });

  it("IPv4 и IPv4 внутри IPv6 — один ключ; IPv6 — по сети /64", () => {
    expect(ipKey("203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("2001:db8:1:2::1")).toBe(ipKey("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"));
    expect(ipKey("[2001:db8:1:2::1%eth0]")).toBe("2001:db8:1:2::/64");
    expect(ipKey("2001:db8:1:3::1")).not.toBe(ipKey("2001:db8:1:2::1"));
    expect(ipKey("")).toBe("unknown");
  });
});
