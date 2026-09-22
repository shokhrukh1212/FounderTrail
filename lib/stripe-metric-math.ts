export type RecurringInput = {
  unitAmountDecimal: string;
  quantity: number;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
};

function decimalRational(value: string): { numerator: bigint; denominator: bigint } {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("INVALID_MONEY");
  const [whole, fraction = ""] = value.split(".");
  return { numerator: BigInt(`${whole}${fraction}`), denominator: BigInt(10) ** BigInt(fraction.length) };
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

/** Returns monthly-normalised minor units using integer rational arithmetic. */
export function normalizeRecurringMonthly(input: RecurringInput): number {
  const amount = decimalRational(input.unitAmountDecimal);
  const quantity = BigInt(Math.max(0, Math.trunc(input.quantity)));
  const count = BigInt(Math.max(1, Math.trunc(input.intervalCount)));
  let numerator = amount.numerator * quantity;
  let denominator = amount.denominator;
  if (input.interval === "day") { numerator *= BigInt(365); denominator *= BigInt(12) * count; }
  if (input.interval === "week") { numerator *= BigInt(52); denominator *= BigInt(12) * count; }
  if (input.interval === "month") denominator *= count;
  if (input.interval === "year") denominator *= BigInt(12) * count;
  const result = roundedDivide(numerator, denominator);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("MONEY_TOO_LARGE");
  return Number(result);
}
