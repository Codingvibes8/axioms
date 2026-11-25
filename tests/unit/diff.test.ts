import { describe, it, expect } from "vitest";

type DiffStatus = "synced" | "missing_in_target" | "missing_in_source" | "value_mismatch";

interface DiffResult {
  key: string;
  status: DiffStatus;
  sourceValue?: string;
  targetValue?: string;
}

function diffEnvironments(
  source: Record<string, string>,
  target: Record<string, string>
): DiffResult[] {
  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  const results: DiffResult[] = [];

  for (const key of allKeys) {
    const inSource = key in source;
    const inTarget = key in target;

    if (inSource && inTarget) {
      if (source[key] === target[key]) {
        results.push({ key, status: "synced", sourceValue: source[key], targetValue: target[key] });
      } else {
        results.push({ key, status: "value_mismatch", sourceValue: source[key], targetValue: target[key] });
      }
    } else if (inSource) {
      results.push({ key, status: "missing_in_target", sourceValue: source[key] });
    } else {
      results.push({ key, status: "missing_in_source", targetValue: target[key] });
    }
  }

  return results.sort((a, b) => a.key.localeCompare(b.key));
}

describe("diff engine", () => {
  it("reports synced when values match", () => {
    const source = { FOO: "bar", BAZ: "qux" };
    const target = { FOO: "bar", BAZ: "qux" };
    const diff = diffEnvironments(source, target);
    expect(diff).toHaveLength(2);
    expect(diff.every(d => d.status === "synced")).toBe(true);
  });

  it("reports value_mismatch when values differ", () => {
    const source = { FOO: "bar" };
    const target = { FOO: "different" };
    const diff = diffEnvironments(source, target);
    expect(diff).toHaveLength(1);
    expect(diff[0].status).toBe("value_mismatch");
    expect(diff[0].sourceValue).toBe("bar");
    expect(diff[0].targetValue).toBe("different");
  });

  it("reports missing_in_target when key only in source", () => {
    const source = { FOO: "bar", EXTRA: "only-here" };
    const target = { FOO: "bar" };
    const diff = diffEnvironments(source, target);
    expect(diff.find(d => d.key === "EXTRA")?.status).toBe("missing_in_target");
  });

  it("reports missing_in_source when key only in target", () => {
    const source = { FOO: "bar" };
    const target = { FOO: "bar", EXTRA: "only-here" };
    const diff = diffEnvironments(source, target);
    expect(diff.find(d => d.key === "EXTRA")?.status).toBe("missing_in_source");
  });

  it("handles multiple differences", () => {
    const source = { A: "1", B: "2", C: "3" };
    const target = { A: "1", B: "different", D: "4" };
    const diff = diffEnvironments(source, target);
    const statuses = diff.map(d => d.status).sort();
    expect(statuses).toEqual(["missing_in_source", "missing_in_target", "synced", "value_mismatch"]);
  });

  it("returns empty array for empty objects", () => {
    expect(diffEnvironments({}, {})).toEqual([]);
  });

  it("sorts results by key", () => {
    const source = { Z: "1", A: "2" };
    const target = { Z: "1", A: "2" };
    const diff = diffEnvironments(source, target);
    expect(diff.map(d => d.key)).toEqual(["A", "Z"]);
  });
});