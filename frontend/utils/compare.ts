// ============================================================
// LocoSnap — Comparison Helpers
// Pure utility functions for numeric parsing and comparison
// ============================================================

export type Winner = "left" | "right" | "tie" | "none";

export function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d,.]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ""));
}

export function compareValues(
  leftVal: string | null,
  rightVal: string | null,
  higherIsBetter: boolean = true
): Winner {
  const leftNum = parseNumeric(leftVal);
  const rightNum = parseNumeric(rightVal);
  if (leftNum === null || rightNum === null) return "none";
  if (leftNum === rightNum) return "tie";
  if (higherIsBetter) {
    return leftNum > rightNum ? "left" : "right";
  }
  return leftNum < rightNum ? "left" : "right";
}
