/**
 * Money is stored as integer centavos (1/100 PHP). All arithmetic on money
 * must happen in centavos; conversion to decimal happens only at render
 * boundaries. Never use binary floating point for money math.
 */

export type Centavos = number & { __centavos: never };

const PESOS_INPUT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
// Thousands separators must be proper 3-digit groups: 5,500 or 1,234,567.
const GROUPED_PATTERN = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;

export class MoneyParseError extends Error {}

/**
 * Parse a user-entered peso amount ("5,500", "5500.50") into integer centavos.
 * Throws MoneyParseError on anything else — callers surface the message.
 */
export function pesosToCentavos(input: string, options?: { allowZero?: boolean }): number {
  const trimmed = input.trim();
  let match: RegExpExecArray | null;
  if (trimmed.includes(",")) {
    match = GROUPED_PATTERN.exec(trimmed);
  } else {
    match = PESOS_INPUT_PATTERN.exec(trimmed);
  }
  if (!match) {
    throw new MoneyParseError("Enter an amount like 5500 or 5,500.50.");
  }
  const pesos = match[1]!.replace(/,/g, "");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const centavos = Number(pesos) * 100 + Number(fraction);
  if (!Number.isSafeInteger(centavos)) {
    throw new MoneyParseError("Amount is too large.");
  }
  if (centavos === 0 && options?.allowZero === false) {
    throw new MoneyParseError("Amount must be greater than zero.");
  }
  return centavos;
}

/** Sum centavos integers. Returns a plain integer; keep the result in centavos. */
export function sumCentavos(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    assertIntegerCentavos(amount);
    total += amount;
  }
  return total;
}

export function assertIntegerCentavos(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new MoneyParseError("Money amounts must be integer centavos.");
  }
}

/**
 * Format centavos for display. Whole pesos render without decimals
 * (₱5,500); amounts with centavos render two decimals (₱5,500.50).
 */
export function formatPHP(centavos: number): string {
  assertIntegerCentavos(centavos);
  const sign = centavos < 0 ? "−" : "";
  const abs = Math.abs(centavos);
  const pesos = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = pesos.toLocaleString("en-PH");
  if (fraction === 0) {
    return `${sign}₱${grouped}`;
  }
  return `${sign}₱${grouped}.${fraction.toString().padStart(2, "0")}`;
}
