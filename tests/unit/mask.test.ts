import { describe, it, expect } from "vitest";

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "•".repeat(value.length);
  }
  return value.slice(0, 4) + "•".repeat(12) + value.slice(-4);
}

describe("secret masking", () => {
  it("masks short values entirely with dots", () => {
    expect(maskSecret("abc")).toBe("•••");
    expect(maskSecret("")).toBe("");
    expect(maskSecret("12345678")).toBe("••••••••");
  });

  it("masks long values with first 4 + 12 dots + last 4", () => {
    const long = "abcdefghijklmnopqrstuvwxyz";
    const masked = maskSecret(long);
    // 4 + 12 + 4 = 20 chars
    expect(masked).toBe("abcd••••••••••••wxyz");
    expect(masked.length).toBe(20);
  });

  it("handles exactly 9 characters", () => {
    const nine = "123456789";
    expect(maskSecret(nine)).toBe("1234••••••••••••6789");
  });

  it("handles unicode characters (JS counts each emoji as 2 code units)", () => {
    const unicode = "🔐secret🔑";
    const masked = maskSecret(unicode);
    // 4 + 12 + 4 = 20 chars
    expect(masked.length).toBe(20);
  });

  it("does not reveal middle characters", () => {
    const value = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
    const masked = maskSecret(value);
    expect(masked.includes("bcdefghijklmnopqrstuvwxy")).toBe(false);
    expect(masked.startsWith("sk-p")).toBe(true);
    expect(masked.endsWith("7890")).toBe(true);
  });
});