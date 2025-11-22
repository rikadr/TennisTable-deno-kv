import { determineSeason } from "../../seasons/seasons";

describe("determineSeason", () => {
  describe("Season start times", () => {
    it("should start Q1 season on first Monday of January at 10:00", () => {
      // January 1, 2024 is a Monday
      const time = new Date(2024, 0, 15).getTime(); // Mid-January
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 0, 1, 10, 0, 0, 0).getTime();
      expect(result.start).toBe(expectedStart);
    });

    it("should start Q2 season on first Monday of April at 10:00", () => {
      // April 1, 2024 is a Monday
      const time = new Date(2024, 3, 15).getTime(); // Mid-April
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 3, 1, 10, 0, 0, 0).getTime();
      expect(result.start).toBe(expectedStart);
    });

    it("should start Q3 season on first Monday of July at 10:00", () => {
      // July 1, 2024 is a Monday
      const time = new Date(2024, 6, 15).getTime(); // Mid-July
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 6, 1, 10, 0, 0, 0).getTime();
      expect(result.start).toBe(expectedStart);
    });

    it("should start Q4 season on first Monday of October at 10:00", () => {
      // October 7, 2024 is the first Monday (Oct 1 is Tuesday)
      const time = new Date(2024, 9, 15).getTime(); // Mid-October
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 9, 7, 10, 0, 0, 0).getTime();
      expect(result.start).toBe(expectedStart);
    });

    it("should handle when first of month is Sunday", () => {
      // September 1, 2024 is a Sunday, so first Monday is Sept 2
      const time = new Date(2024, 8, 15).getTime(); // Mid-September (Q3)
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 6, 1, 10, 0, 0, 0).getTime(); // July 1 is Monday
      expect(result.start).toBe(expectedStart);
    });

    it("should handle when first of month is Tuesday", () => {
      // October 1, 2024 is a Tuesday, so first Monday is Oct 7
      const time = new Date(2024, 9, 15).getTime();
      const result = determineSeason(time);

      const expectedStart = new Date(2024, 9, 7, 10, 0, 0, 0).getTime();
      expect(result.start).toBe(expectedStart);
    });
  });

  describe("Season end times", () => {
    it("should end Q1 season on Friday at 17:00, 10 days before Q2 starts", () => {
      const time = new Date(2024, 0, 15).getTime(); // Mid-January (Q1)
      const result = determineSeason(time);

      // Q2 starts April 1 (Monday) at 10:00
      // 10 days before = March 22
      // Find the Friday before that at 17:00
      const q2Start = new Date(2024, 3, 1, 10, 0, 0, 0).getTime();
      const tenDaysBefore = q2Start - 10 * 24 * 60 * 60 * 1000;
      const expectedEnd = new Date(tenDaysBefore);
      expectedEnd.setHours(17, 0, 0, 0);

      expect(result.end).toBe(expectedEnd.getTime());
    });

    it("should set end time to 17:00 exactly", () => {
      const time = new Date(2024, 1, 15).getTime(); // Mid-February (Q1)
      const result = determineSeason(time);

      const endDate = new Date(result.end);
      expect(endDate.getHours()).toBe(17);
      expect(endDate.getMinutes()).toBe(0);
      expect(endDate.getSeconds()).toBe(0);
      expect(endDate.getMilliseconds()).toBe(0);
    });
  });

  describe("Quarter boundaries", () => {
    it("should return Q1 for January", () => {
      const time = new Date(2024, 0, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(0); // January
    });

    it("should return Q1 for February", () => {
      const time = new Date(2024, 1, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(0); // January
    });

    it("should return Q1 for March", () => {
      const time = new Date(2024, 2, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(0); // January
    });

    it("should return Q2 for April", () => {
      const time = new Date(2024, 3, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(3); // April
    });

    it("should return Q3 for July", () => {
      const time = new Date(2024, 6, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(6); // July
    });

    it("should return Q4 for October", () => {
      const time = new Date(2024, 9, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(9); // October
    });
  });

  describe("10-day gap period", () => {
    it("should return the just-ended season when time is in the 10-day gap", () => {
      // Q2 2024 starts April 1 at 10:00
      // Q1 ends 10 days before (March 22) at 17:00
      // March 23-31 is the gap period and should return Q1 season
      const timeInGap = new Date(2024, 2, 25, 12, 0, 0, 0).getTime(); // March 25
      const result = determineSeason(timeInGap);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(0); // Should return Q1 (January start)
    });

    it("should return the just-ended season on the last day of gap period", () => {
      // Test on March 31 (last day before Q2 starts April 1)
      const timeInGap = new Date(2024, 2, 31, 23, 59, 59, 999).getTime();
      const result = determineSeason(timeInGap);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(0); // Should return Q1
    });
  });

  describe("Edge cases", () => {
    it("should handle exact season start time", () => {
      const seasonStartTime = new Date(2024, 0, 1, 10, 0, 0, 0).getTime();
      const result = determineSeason(seasonStartTime);

      expect(result.start).toBe(seasonStartTime);
    });

    it("should handle exact season end time", () => {
      const time = new Date(2024, 0, 15).getTime();
      const result = determineSeason(time);

      // Season should end at exactly 17:00:00.000
      const endDate = new Date(result.end);
      expect(endDate.getHours()).toBe(17);
      expect(endDate.getMinutes()).toBe(0);
      expect(endDate.getSeconds()).toBe(0);
      expect(endDate.getMilliseconds()).toBe(0);
    });

    it("should handle year boundary (December to January)", () => {
      const time = new Date(2024, 11, 15).getTime(); // December
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getMonth()).toBe(9); // October (Q4)
      expect(startDate.getFullYear()).toBe(2024);
    });

    it("should handle leap year", () => {
      const time = new Date(2024, 1, 29).getTime(); // Feb 29, 2024 (leap year)
      const result = determineSeason(time);

      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
      expect(result.start).toBeLessThan(result.end);
    });
  });

  describe("Season duration", () => {
    it("should have season end after season start", () => {
      const time = new Date(2024, 5, 15).getTime();
      const result = determineSeason(time);

      expect(result.end).toBeGreaterThan(result.start);
    });

    it("should have approximately 3 months minus 10 days duration", () => {
      const time = new Date(2024, 0, 15).getTime();
      const result = determineSeason(time);

      const durationMs = result.end - result.start;
      const durationDays = durationMs / (24 * 60 * 60 * 1000);

      // Should be approximately 3 months (90 days) minus 10 days = ~80 days
      // Allowing some variance due to month length differences
      expect(durationDays).toBeGreaterThan(70);
      expect(durationDays).toBeLessThan(90);
    });
  });

  describe("Different years", () => {
    it("should handle 2023", () => {
      const time = new Date(2023, 6, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getFullYear()).toBe(2023);
      expect(startDate.getMonth()).toBe(6); // July
    });

    it("should handle 2025", () => {
      const time = new Date(2025, 3, 15).getTime();
      const result = determineSeason(time);

      const startDate = new Date(result.start);
      expect(startDate.getFullYear()).toBe(2025);
      expect(startDate.getMonth()).toBe(3); // April
    });
  });
});
