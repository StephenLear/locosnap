import { canonicaliseOperator } from "../../services/operatorNames";

describe("canonicaliseOperator", () => {
  describe("merges spelling variants of the SAME operator", () => {
    it.each([
      ["DB Fernverkehr AG", "DB Fernverkehr"],
      ["Deutsche Bahn (DB Fernverkehr)", "DB Fernverkehr"],
      ["DB Fernverkehr (Deutsche Bahn)", "DB Fernverkehr"],
      ["DB Cargo AG", "DB Cargo"],
      ["Deutsche Bahn (DB Cargo)", "DB Cargo"],
      ["DB Schenker Rail", "DB Cargo"],
      ["Railion", "DB Cargo"],
      ["DB Regio AG", "DB Regio"],
      ["Deutsche Bahn (DB Regio)", "DB Regio"],
    ])("%s -> %s", (input, expected) => {
      expect(canonicaliseOperator(input)).toBe(expected);
    });

    it("all spellings of DB Fernverkehr converge to one key", () => {
      const variants = [
        "DB Fernverkehr",
        "DB Fernverkehr AG",
        "Deutsche Bahn (DB Fernverkehr)",
        "DB Fernverkehr (Deutsche Bahn)",
      ];
      const canonical = variants.map(canonicaliseOperator);
      expect(new Set(canonical).size).toBe(1);
      expect(canonical[0]).toBe("DB Fernverkehr");
    });
  });

  describe("NEVER merges distinct DB sub-operators", () => {
    it("Cargo, Fernverkehr and Regio stay distinct", () => {
      const cargo = canonicaliseOperator("DB Cargo AG");
      const fern = canonicaliseOperator("DB Fernverkehr AG");
      const regio = canonicaliseOperator("DB Regio AG");
      expect(new Set([cargo, fern, regio]).size).toBe(3);
    });
  });

  describe("leaves ambiguous bare DB strings untouched", () => {
    it.each([
      "DB (Deutsche Bahn)",
      "Deutsche Bahn",
    ])("%s is unchanged (could be any DB arm)", (input) => {
      expect(canonicaliseOperator(input)).toBe(input);
    });
  });

  describe("leaves unknown / non-DB operators untouched", () => {
    it.each([
      "DB Fernverkehr",
      "DB Cargo",
      "DB Regio",
      "Avanti West Coast",
      "LNER",
      "ÖBB",
      "PKP Intercity",
      "POLREGIO",
      "Lokomotion",
      "SBB",
      "Network Rail",
    ])("%s is unchanged", (input) => {
      expect(canonicaliseOperator(input)).toBe(input);
    });
  });

  describe("hygiene", () => {
    it("is idempotent", () => {
      const once = canonicaliseOperator("Deutsche Bahn (DB Cargo)");
      expect(canonicaliseOperator(once)).toBe(once);
    });
    it("collapses internal + edge whitespace", () => {
      expect(canonicaliseOperator("  DB   Cargo   AG  ")).toBe("DB Cargo");
    });
    it("matches case-insensitively", () => {
      expect(canonicaliseOperator("db cargo ag")).toBe("DB Cargo");
    });
    it("handles empty / nullish input without throwing", () => {
      expect(canonicaliseOperator("")).toBe("");
      expect(canonicaliseOperator(undefined as unknown as string)).toBeUndefined();
    });
  });
});
