import { useEffect, useState } from "react";

type RelativeTimeVariant = "long" | "short" | "auto";

/**
 * variant:
 * - "long" (default): "21 hours ago"
 * - "short": "21h ago" — for tight table columns
 * - "auto": short below the md breakpoint, long from md up
 */
export const RelativeTime: React.FC<{ date: Date; variant?: RelativeTimeVariant }> = ({ date, variant = "long" }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Update more frequently for recent times, less for old times
    const diff = Math.abs(Date.now() - date.getTime());
    const interval =
      diff < 60_000
        ? 5_000 // < 1 min: every 5 seconds
        : diff < 3600_000
        ? 60_000 // < 1 hour: every minute
        : 300_000; // > 1 hour: every 5 minutes

    const timer = setInterval(() => setTick((tick) => tick + 1), interval);
    return () => clearInterval(timer);
  }, [date]);

  if (variant === "short") {
    return <>{relativeTimeStringShort(date)}</>;
  }
  if (variant === "auto") {
    return (
      <>
        <span className="md:hidden">{relativeTimeStringShort(date)}</span>
        <span className="hidden md:inline">{relativeTimeString(date)}</span>
      </>
    );
  }
  return <>{relativeTimeString(date)}</>;
};

export function relativeTimeString(date?: Date): string {
  if (!date || date instanceof Date === false) {
    return "";
  }
  const now = new Date();
  return formatDistance(date, now, { addSuffix: true });
}

export function relativeTimeStringShort(date?: Date): string {
  if (!date || date instanceof Date === false) {
    return "";
  }
  const comparison = date.getTime() - Date.now();
  const isPast = comparison < 0;
  const minutes = Math.round(Math.abs(comparison) / 60_000);

  if (minutes < 1) {
    return isPast ? "just now" : "soon";
  }

  // Thresholds mirror formatDistance below so long and short agree on the unit
  let result: string;
  if (minutes < 45) {
    result = `${minutes}m`;
  } else if (minutes < 1440) {
    result = `${Math.max(1, Math.round(minutes / 60))}h`;
  } else if (minutes < 43200) {
    result = `${Math.round(minutes / 1440)}d`;
  } else if (minutes < 43200 * 12) {
    result = `${Math.round(minutes / 43200)}mo`;
  } else {
    result = `${Math.floor(minutes / (43200 * 12))}y`;
  }

  return isPast ? `${result} ago` : `in ${result}`;
}

// Formats an epoch timestamp as a full date, e.g. "5. januar 2026".
export function dateString(time: number) {
  return new Date(time).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Full date and time with the weekday, e.g. "Mandag 1. April 2026 08:37".
// Norwegian locale writes weekdays and months in lowercase; capitalize them
// so the line reads as a heading.
export function fullDateTimeString(time: number): string {
  const date = new Date(time);
  const datePart = date
    .toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/\p{L}+/gu, (word) => word[0].toUpperCase() + word.slice(1));
  const timePart = date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

// Clock time only, e.g. "08:37". For a time whose date is already on screen.
export function clockTimeString(time: number): string {
  return new Date(time).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

// Month-granularity variant of dateString, for periods that span a whole
// calendar month (e.g. "januar 2026").
export function monthString(time: number) {
  return new Date(time).toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
  });
}

// Rounds up, so a span within the first day reads as "1 day", never "0 days".
export function daysBetweenCeiled(from: number, to: number): number {
  return Math.ceil((to - from) / (24 * 60 * 60 * 1000));
}

interface FormatDistanceOptions {
  includeSeconds?: boolean;
  addSuffix?: boolean;
}

function formatDistance(laterDate: Date, earlierDate: Date, options?: FormatDistanceOptions): string {
  const minutesInDay = 1440;
  const minutesInMonth = 43200;
  const minutesInAlmostTwoDays = 2520;

  const comparison = laterDate.getTime() - earlierDate.getTime();
  const isPast = comparison < 0;

  const [later, earlier] = isPast ? [earlierDate, laterDate] : [laterDate, earlierDate];

  const seconds = Math.floor((later.getTime() - earlier.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);

  let result: string;

  // 0 up to 2 mins
  if (minutes < 2) {
    if (options?.includeSeconds) {
      if (seconds < 5) {
        result = "less than 5 seconds";
      } else if (seconds < 10) {
        result = "less than 10 seconds";
      } else if (seconds < 20) {
        result = "less than 20 seconds";
      } else if (seconds < 40) {
        result = "half a minute";
      } else if (seconds < 60) {
        result = "less than a minute";
      } else {
        result = "1 minute";
      }
    } else {
      if (minutes === 0) {
        result = "less than a minute";
      } else {
        result = "1 minute";
      }
    }
  }
  // 2 mins up to 0.75 hrs
  else if (minutes < 45) {
    result = `${minutes} minutes`;
  }
  // 0.75 hrs up to 1.5 hrs
  else if (minutes < 90) {
    result = "1 hour";
  }
  // 1.5 hrs up to 24 hrs
  else if (minutes < minutesInDay) {
    const hours = Math.round(minutes / 60);
    result = `${hours} hours`;
  }
  // 1 day up to 1.75 days
  else if (minutes < minutesInAlmostTwoDays) {
    result = "1 day";
  }
  // 1.75 days up to 30 days
  else if (minutes < minutesInMonth) {
    const days = Math.round(minutes / minutesInDay);
    result = `${days} days`;
  }
  // 1 month up to 2 months
  else if (minutes < minutesInMonth * 2) {
    const months = Math.round(minutes / minutesInMonth);
    result = `${months} ${months === 1 ? "month" : "months"}`;
  }
  // 2 months and beyond
  else {
    const totalMonths = Math.floor(
      (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth()),
    );

    // 2 months up to 12 months
    if (totalMonths < 12) {
      const nearestMonth = Math.round(minutes / minutesInMonth);
      result = `${nearestMonth} months`;
    }
    // 1 year and up
    else {
      const monthsSinceStartOfYear = totalMonths % 12;
      const years = Math.floor(totalMonths / 12);

      // N years up to N years 3 months
      if (monthsSinceStartOfYear < 3) {
        result = `${years} ${years === 1 ? "year" : "years"}`;
      }
      // N years 3 months up to N years 9 months
      else if (monthsSinceStartOfYear < 9) {
        result = `over ${years} ${years === 1 ? "year" : "years"}`;
      }
      // N years 9 months up to N+1 years
      else {
        result = `almost ${years + 1} ${years + 1 === 1 ? "year" : "years"}`;
      }
    }
  }

  if (options?.addSuffix) {
    result = isPast ? `${result} ago` : `in ${result}`;
  }

  return result[0].toUpperCase() + result.slice(1);
}

// Convert a millisecond timestamp into the local "YYYY-MM-DDTHH:mm:ss" string
// expected by a <input type="datetime-local"> element (step 1 for seconds).
export function toDatetimeLocalValue(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

// A datetime-local string parses as local time. Returns undefined while the
// input is incomplete (the browser then reports an empty value).
export function fromDatetimeLocalValue(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return isNaN(ms) ? undefined : ms;
}
