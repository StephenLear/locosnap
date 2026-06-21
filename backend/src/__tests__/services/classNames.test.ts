import { canonicaliseClass } from "../../services/classNames";

describe("canonicaliseClass", () => {
  describe("merges German operator-prefix / spelling variants to one form", () => {
    it.each([
      ["DB BR 232", "BR 232"],
      ["BR 232", "BR 232"],
      ["db br 232", "BR 232"],
      ["DB BR 101", "BR 101"],
      ["BR 101", "BR 101"],
      ["DB BR 218", "BR 218"],
      ["DB BR 110", "BR 110"],
      ["DB BR 143", "BR 143"],
      ["DB BR 185", "BR 185"],
    ])("%s -> %s", (input, expected) => {
      expect(canonicaliseClass(input)).toBe(expected);
    });
  });

  describe("'Baureihe' becomes 'BR'", () => {
    it.each([
      ["Baureihe 628", "BR 628"],
      ["DB Baureihe 628", "BR 628"],
      ["baureihe 232", "BR 232"],
    ])("%s -> %s", (input, expected) => {
      expect(canonicaliseClass(input)).toBe(expected);
    });
  });

  describe("German 'DB Class N' becomes 'BR N' (DB prefix proves German)", () => {
    it.each([
      ["DB Class 628", "BR 628"],
      ["DB Class 182", "BR 182"],
    ])("%s -> %s", (input, expected) => {
      expect(canonicaliseClass(input)).toBe(expected);
    });
  });

  describe("all spellings of the same class converge", () => {
    it("BR 628 family collapses to one key", () => {
      const variants = ["BR 628", "DB BR 628", "Baureihe 628", "DB Baureihe 628", "DB Class 628"];
      const canonical = variants.map(canonicaliseClass);
      expect(new Set(canonical).size).toBe(1);
      expect(canonical[0]).toBe("BR 628");
    });
  });

  describe("explicit cross-designation synonyms", () => {
    it("DR BR 132 (East German) maps to its post-1992 BR 232 number", () => {
      expect(canonicaliseClass("DR BR 132")).toBe("BR 232");
    });

    it.each([
      ["ST22", "ET22"],
      ["st22", "ET22"],
      ["ST 22", "ET22"],
      ["ST-22", "ET22"],
      ["PKP ST22", "ET22"],
    ])("non-existent '%s' is rewritten to the real ET22 (misID fix 2026-06-21)", (input, expected) => {
      expect(canonicaliseClass(input)).toBe(expected);
    });
  });

  describe("leaves non-German / ambiguous labels untouched", () => {
    it.each([
      "Class 66",
      "Class 37",
      "Class 800",
      "ICE 3",
      "ÖBB 1116",
      "EP07",
      "EN57",
      "Stadler FLIRT",
      "NS Class 1700",
      "ČD Class 754",
    ])("%s is unchanged", (input) => {
      expect(canonicaliseClass(input)).toBe(input);
    });

    it("preserves non-DB railway prefixes (DR stays DR)", () => {
      expect(canonicaliseClass("DR Baureihe 01")).toBe("DR BR 01");
    });
  });

  describe("hygiene", () => {
    it("is idempotent", () => {
      const once = canonicaliseClass("DB BR 232");
      expect(canonicaliseClass(once)).toBe(once);
    });
    it("collapses internal whitespace", () => {
      expect(canonicaliseClass("DB   BR   232")).toBe("BR 232");
    });
    it("handles empty / nullish input without throwing", () => {
      expect(canonicaliseClass("")).toBe("");
      expect(canonicaliseClass(undefined as unknown as string)).toBeUndefined();
    });
  });
});
