export function fmtNum(number?: number, options?: { digits?: number; signedPositive?: boolean }) {
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

  const stringified = number.toLocaleString("no-NO", {
    maximumFractionDigits: options?.digits ?? autoDigits,
  });

  if (options?.signedPositive && number > 0) {
    return "+" + stringified;
  }

  return stringified;
}
