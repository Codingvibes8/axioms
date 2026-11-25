import { describe, it, expect } from "vitest";

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    let key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;

    result[key] = value;
  }

  return result;
}

describe(".env parser", () => {
  it("parses basic KEY=value", () => {
    const result = parseEnv("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("handles quoted values", () => {
    const result = parseEnv('FOO="bar baz"\nBAZ=\'qux quux\'');
    expect(result).toEqual({ FOO: "bar baz", BAZ: "qux quux" });
  });

  it("skips comments and blank lines", () => {
    const result = parseEnv("# comment\n\nFOO=bar\n  \nBAZ=qux # inline");
    // Note: inline comments after values are NOT stripped by this parser
    expect(result).toEqual({ FOO: "bar", BAZ: "qux # inline" });
  });

  it("handles CRLF line endings", () => {
    const result = parseEnv("FOO=bar\r\nBAZ=qux\r\n");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("rejects invalid keys (lowercase, numbers first)", () => {
    const result = parseEnv("foo=bar\n1INVALID=val\nVALID_KEY=ok");
    expect(result).toEqual({ VALID_KEY: "ok" });
  });

  it("keeps last value for duplicate keys", () => {
    const result = parseEnv("FOO=first\nFOO=second\nFOO=third");
    expect(result).toEqual({ FOO: "third" });
  });

  it("handles empty values", () => {
    const result = parseEnv("EMPTY=\nALSO_EMPTY=");
    expect(result).toEqual({ EMPTY: "", ALSO_EMPTY: "" });
  });

  it("handles special characters in values", () => {
    const result = parseEnv('SPECIAL="!@#$%^&*()"');
    expect(result.SPECIAL).toBe("!@#$%^&*()");
  });
});