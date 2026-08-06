import { useEffect, useRef, useState } from "react";
import { ONE_MINUTE, ONE_SECOND } from "../common/time-in-ms";
import { reloadPage } from "../common/reload-page";

/**
 * Detects when a new frontend deployment has happened and refreshes the page.
 *
 * How: the production build emits a content-hashed bundle (static/js/main.<hash>.js)
 * referenced from index.html. We periodically re-fetch index.html (bypassing the
 * cache) and compare the deployed bundle path with the one currently running.
 * A mismatch means a new version has been deployed.
 *
 * Safeguard: instead of refreshing immediately (which would lose in-progress
 * state like game tracking or form input), a popup offers "Refresh now" or
 * "Later". If the popup is not addressed within 1 minute, the page refreshes
 * automatically. "Later" snoozes the popup for 30 minutes.
 */

export const CHECK_INTERVAL_MS = 5 * ONE_MINUTE;
export const AUTO_REFRESH_AFTER_SECONDS = 60;
export const SNOOZE_MS = 30 * ONE_MINUTE;
const MIN_TIME_BETWEEN_CHECKS_MS = ONE_MINUTE;

const MAIN_BUNDLE_PATTERN = /static\/js\/main\.[^"'\s]+\.js/;

export function extractMainBundle(html: string): string | undefined {
  return html.match(MAIN_BUNDLE_PATTERN)?.[0];
}

/** The bundle this page is currently running. Undefined on the dev server (unhashed bundle). */
function getRunningBundle(): string | undefined {
  const scripts = Array.from(document.querySelectorAll("script"));
  for (const script of scripts) {
    const match = extractMainBundle(script.src);
    if (match) return match;
  }
  return undefined;
}

async function fetchDeployedBundle(): Promise<string | undefined> {
  try {
    const response = await fetch("/index.html", { cache: "no-store" });
    if (!response.ok) return undefined;
    return extractMainBundle(await response.text());
  } catch {
    return undefined;
  }
}

export const NewVersionChecker: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REFRESH_AFTER_SECONDS);
  const newVersionFoundRef = useRef(false);
  const lastCheckStartedRef = useRef(0);
  const snoozeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const runningBundle = getRunningBundle();
    if (!runningBundle) return;

    let cancelled = false;

    async function check() {
      if (newVersionFoundRef.current) return;
      lastCheckStartedRef.current = Date.now();
      const deployedBundle = await fetchDeployedBundle();
      if (cancelled || newVersionFoundRef.current) return;
      if (!deployedBundle || deployedBundle === runningBundle) return;

      newVersionFoundRef.current = true;
      setSecondsLeft(AUTO_REFRESH_AFTER_SECONDS);
      setShowPopup(true);
    }

    const interval = setInterval(check, CHECK_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckStartedRef.current < MIN_TIME_BETWEEN_CHECKS_MS) return;
      check();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(snoozeTimeoutRef.current);
    };
  }, []);

  // Count down while the popup is open, refresh when it reaches 0
  useEffect(() => {
    if (!showPopup) return;
    const interval = setInterval(() => setSecondsLeft((seconds) => seconds - 1), ONE_SECOND);
    return () => clearInterval(interval);
  }, [showPopup]);

  useEffect(() => {
    if (showPopup && secondsLeft <= 0) {
      reloadPage();
    }
  }, [showPopup, secondsLeft]);

  function snooze() {
    setShowPopup(false);
    clearTimeout(snoozeTimeoutRef.current);
    snoozeTimeoutRef.current = setTimeout(() => {
      setSecondsLeft(AUTO_REFRESH_AFTER_SECONDS);
      setShowPopup(true);
    }, SNOOZE_MS);
  }

  if (!showPopup) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] sm:left-auto sm:w-96">
      <div className="flex flex-col gap-3 rounded-lg bg-secondary-background text-secondary-text p-4 shadow-lg ring-1 ring-primary-text/20">
        <div>
          <p className="font-semibold">New version available 🏓</p>
          <p className="mt-1 text-sm">
            A new version of the app has been deployed. The page refreshes automatically in {Math.max(0, secondsLeft)}{" "}
            seconds.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reloadPage}
            className="flex-1 rounded-lg bg-primary-background px-4 py-2 font-semibold text-primary-text hover:bg-primary-background/70"
          >
            Refresh now
          </button>
          <button
            onClick={snooze}
            className="flex-1 rounded-lg bg-tertiary-background px-4 py-2 text-tertiary-text hover:bg-tertiary-background/70"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
