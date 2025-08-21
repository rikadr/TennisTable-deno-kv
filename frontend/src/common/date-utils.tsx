import { useEffect, useState } from "react";

export const RelativeTime: React.FC<{ date: Date }> = ({ date }) => {
  const [timeString, setTimeString] = useState(relativeTimeString(date));
  const updateInterval = 5_000;

  useEffect(() => {
    // Update immediately
    setTimeString(relativeTimeString(date));

    // Set up interval to update every updateInterval milliseconds
    const interval = setInterval(() => {
      setTimeString(relativeTimeString(date));
    }, updateInterval);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [date, updateInterval]);

  return timeString;
};

export function relativeTimeString(date: Date): string {
  if (date.getTime() > new Date().getTime()) {
    return timeTo(date);
  } else {
    return timeAgo(date);
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + " years ago";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + " months ago";
  }
  interval = seconds / 604800;
  if (interval > 1) {
    return Math.floor(interval) + " weeks ago";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + " days ago";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + " hours ago";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
}

function timeTo(date: Date): string {
  const seconds = Math.floor((date.getTime() - new Date().getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " years";
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " months";
  }
  interval = seconds / 604800;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " weeks";
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " days";
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " hours";
  }
  interval = seconds / 60;
  if (interval > 1) {
    return "In " + Math.floor(interval) + " minutes";
  }
  return "In " + Math.floor(seconds) + " seconds";
}
