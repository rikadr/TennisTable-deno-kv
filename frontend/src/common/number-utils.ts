export function fmtNum(number: number, digits: number = 0) {
  return number.toLocaleString("no-NO", {
    maximumFractionDigits: digits,
  });
}
