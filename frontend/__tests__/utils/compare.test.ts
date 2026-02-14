import { parseNumeric, compareValues } from "../../utils/compare";

describe("parseNumeric", () => {
  it("extracts number from speed string", () => {
    expect(parseNumeric("125 mph")).toBe(125);
  });

  it("handles commas in large numbers", () => {
    expect(parseNumeric("2,250 HP")).toBe(2250);
  });

  it("handles decimal values", () => {
    expect(parseNumeric("22.1 m")).toBe(22.1);
  });

  it("returns null for null input", () => {
    expect(parseNumeric(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNumeric("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseNumeric("N/A")).toBeNull();
  });

  it("handles plain numbers", () => {
    expect(parseNumeric("42")).toBe(42);
  });

  it("handles numbers with units", () => {
    expect(parseNumeric("5,100 kW")).toBe(5100);
  });
});

describe("compareValues", () => {
  it("returns left when left is higher (higher is better)", () => {
    expect(compareValues("200 mph", "125 mph")).toBe("left");
  });

  it("returns right when right is higher (higher is better)", () => {
    expect(compareValues("100 mph", "200 mph")).toBe("right");
  });

  it("returns tie when values are equal", () => {
    expect(compareValues("125 mph", "125 mph")).toBe("tie");
  });

  it("returns none when left is null", () => {
    expect(compareValues(null, "125 mph")).toBe("none");
  });

  it("returns none when right is null", () => {
    expect(compareValues("125 mph", null)).toBe("none");
  });

  it("returns none when values are non-numeric", () => {
    expect(compareValues("N/A", "N/A")).toBe("none");
  });

  it("inverts comparison when higherIsBetter is false", () => {
    // Weight: lower is better
    expect(compareValues("50 tonnes", "80 tonnes", false)).toBe("left");
    expect(compareValues("80 tonnes", "50 tonnes", false)).toBe("right");
  });

  it("handles commas in comparison", () => {
    expect(compareValues("2,250 HP", "1,500 HP")).toBe("left");
  });
});
