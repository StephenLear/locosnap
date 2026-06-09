import { localiseClassName } from "../../utils/classDisplay";

describe("localiseClassName", () => {
  describe("de locale — German classes become 'Baureihe'", () => {
    it.each([
      ["BR 218", "Baureihe 218"],
      ["DB BR 218", "DB Baureihe 218"],
      ["BR 143", "Baureihe 143"],
      ["DB Class 218", "DB Baureihe 218"],
    ])("%s -> %s", (input, expected) => {
      expect(localiseClassName(input, "de")).toBe(expected);
    });
  });

  describe("de locale — non-German names are NOT touched", () => {
    it.each([
      "Class 37",        // UK
      "Class 800",       // UK
      "Newag Dragon",    // PL
      "ICE 3",
      "ÖBB 1116",
      "Stadler FLIRT",
      "EN57",
    ])("%s is unchanged", (input) => {
      expect(localiseClassName(input, "de")).toBe(input);
    });
  });

  describe("non-de locales pass through unchanged", () => {
    it.each(["en", "pl"])("locale %s leaves 'BR 218' as-is", (loc) => {
      expect(localiseClassName("BR 218", loc)).toBe("BR 218");
    });
    it("en leaves 'DB Class 218' as-is", () => {
      expect(localiseClassName("DB Class 218", "en")).toBe("DB Class 218");
    });
  });

  describe("hygiene", () => {
    it("is idempotent under de", () => {
      const once = localiseClassName("BR 218", "de");
      expect(localiseClassName(once, "de")).toBe("Baureihe 218");
    });
    it("handles empty / nullish without throwing", () => {
      expect(localiseClassName("", "de")).toBe("");
      expect(localiseClassName(undefined as unknown as string, "de")).toBeUndefined();
    });
    it("does not rewrite a stray 'BR' not followed by a number", () => {
      expect(localiseClassName("BR Standard 4", "de")).toBe("BR Standard 4");
    });
  });
});
