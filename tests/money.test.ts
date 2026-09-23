import { describe, expect, it } from "vitest";
import {
  MoneyParseError,
  formatPHP,
  pesosToCentavos,
  sumCentavos,
} from "@/lib/money";

describe("pesosToCentavos", () => {
  it("parses whole pesos", () => {
    expect(pesosToCentavos("5500")).toBe(550_000);
    expect(pesosToCentavos("0")).toBe(0);
  });

  it("parses pesos with thousands separators", () => {
    expect(pesosToCentavos("5,500")).toBe(550_000);
    expect(pesosToCentavos("1,234,567")).toBe(123_456_700);
  });

  it("parses up to two decimal places without float error", () => {
    expect(pesosToCentavos("5500.50")).toBe(550_050);
    expect(pesosToCentavos("0.01")).toBe(1);
    expect(pesosToCentavos("0.10")).toBe(10);
  });

  it("rejects malformed input", () => {
    expect(() => pesosToCentavos("abc")).toThrow(MoneyParseError);
    expect(() => pesosToCentavos("5.005")).toThrow(MoneyParseError);
    expect(() => pesosToCentavos("-100")).toThrow(MoneyParseError);
    expect(() => pesosToCentavos("")).toThrow(MoneyParseError);
    expect(() => pesosToCentavos("10,00")).toThrow(MoneyParseError);
  });

  it("rejects zero when allowZero is false", () => {
    expect(() => pesosToCentavos("0", { allowZero: false })).toThrow(
      MoneyParseError,
    );
  });
});

describe("sumCentavos", () => {
  it("sums integers exactly", () => {
    expect(sumCentavos([550_000, 500_00, 1])).toBe(600_001);
    expect(sumCentavos([])).toBe(0);
  });

  it("rejects fractional input", () => {
    expect(() => sumCentavos([100.5])).toThrow(MoneyParseError);
  });
});

describe("formatPHP", () => {
  it("formats whole pesos without decimals", () => {
    expect(formatPHP(550_000)).toBe("₱5,500");
    expect(formatPHP(0)).toBe("₱0");
  });

  it("formats centavos with two decimals", () => {
    expect(formatPHP(550_050)).toBe("₱5,500.50");
    expect(formatPHP(5)).toBe("₱0.05");
  });

  it("formats negative amounts with a minus sign", () => {
    expect(formatPHP(-550_000)).toBe("−₱5,500");
  });
});
