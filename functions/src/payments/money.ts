export function toMinorUnits(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
}

export function fromMinorUnits(value: number): number {
  return value / 100;
}

export function sumMoney<T>(
  records: T[],
  getAmount: (record: T) => unknown
): number {
  const minorUnits = records.reduce((total, record) =>
    total + (toMinorUnits(getAmount(record)) ?? 0), 0);
  return fromMinorUnits(minorUnits);
}

export function moneyEquals(left: unknown, right: unknown): boolean {
  const leftMinor = toMinorUnits(left);
  const rightMinor = toMinorUnits(right);
  return leftMinor !== null && rightMinor !== null && leftMinor === rightMinor;
}
