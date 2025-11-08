import { useEffect, useState } from "react";

export const RelativeTime: React.FC<{ date: Date }> = ({ date }) => {
  const [timeString, setTimeString] = useState(() => relativeTimeString(date));

  useEffect(() => {
    const update = () => setTimeString(relativeTimeString(date));
    update();

    // Update more frequently for recent times, less for old times
    const diff = Math.abs(Date.now() - date.getTime());
    const interval =
      diff < 60_000
        ? 5_000 // < 1 min: every 5 seconds
        : diff < 3600_000
        ? 60_000 // < 1 hour: every minute
        : 300_000; // > 1 hour: every 5 minutes

    const timer = setInterval(update, interval);
    return () => clearInterval(timer);
  }, [date]);

  return <>{timeString}</>;
};

export function relativeTimeString(date?: Date): string {
  if (!date || date instanceof Date === false) {
    return "";
  }
  const now = new Date();
  return formatDistance(date, now, { addSuffix: true });
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
