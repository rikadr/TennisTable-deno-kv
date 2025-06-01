export function fmtNum(number?: number, digits?: number) {
  if (number === undefined) {
    return undefined;
  }

  let autoDigits = 0;
  if (number < 1 && number > -1) {
    autoDigits = 1;
  }
  if (number < 0.1 && number > -0.1) {
    autoDigits = 2;
  }

  return number.toLocaleString("no-NO", {
    maximumFractionDigits: digits ?? autoDigits,
  });
}
