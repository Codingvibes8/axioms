import { describe, it, expect, beforeAll } from "vitest";

describe("crypto utilities", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_SECRET_KEY = "a".repeat(64);
  });

  describe("hashToken", () => {
    it("produces a deterministic SHA-256 hash", async () => {
      const { hashToken } = await import("@/lib/crypto");
      const hash1 = hashToken("test-token-123");
      const hash2 = hashToken("test-token-123");
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hashes for different inputs", async () => {
      const { hashToken } = await import("@/lib/crypto");
      expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
    });
  });

  describe("getTokenSuffix", () => {
    it("returns the last N characters", async () => {
      const { getTokenSuffix } = await import("@/lib/crypto");
      expect(getTokenSuffix("abcdef", 4)).toBe("cdef");
      expect(getTokenSuffix("abcdef", 2)).toBe("ef");
    });

    it("handles short strings", async () => {
      const { getTokenSuffix } = await import("@/lib/crypto");
      expect(getTokenSuffix("ab", 4)).toBe("ab");
    });
  });

  describe("generateSecureToken", () => {
    it("returns a hex string of the specified length", async () => {
      const { generateSecureToken } = await import("@/lib/crypto");
      const token = generateSecureToken(32);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different tokens on each call", async () => {
      const { generateSecureToken } = await import("@/lib/crypto");
      const t1 = generateSecureToken(16);
      const t2 = generateSecureToken(16);
      expect(t1).not.toBe(t2);
    });
  });
});