export function fmtNum(number?: number, digits?: number) {
  if (number === undefined) {
    return undefined;
  }
  if (digits === undefined) {
    digits = 0;
  }

  return number.toLocaleString("no-NO", {
    maximumFractionDigits: digits,
  });
}
