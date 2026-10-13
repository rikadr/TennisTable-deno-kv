import { daysAndYearsString } from "./date-utils";

const DAY = 24 * 60 * 60 * 1000;

describe("daysAndYearsString", () => {
  it("gives the years with one decimal and a decimal comma", () => {
    expect(daysAndYearsString(0, 874 * DAY)).toBe("874 days (2,4 years)");
  });

  it("uses the singular for exactly one year", () => {
    expect(daysAndYearsString(0, 365 * DAY)).toBe("365 days (1 year)");
  });
});
