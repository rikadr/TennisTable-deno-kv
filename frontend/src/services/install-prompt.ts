/**
 * Captures the browser's `beforeinstallprompt` event so the settings page can
 * offer an "Install app" button. The event fires early (often before React
 * mounts), so the capture is installed from index.tsx and the deferred prompt
 * is kept here for later use.
 */

/** Not in the TS DOM lib: the Chromium-only event behind "Add to home screen". */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function initInstallPromptCapture() {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Stop Chrome's mini-infobar; the settings page offers the install instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** True when the app already runs as an installed app (standalone window). */
export function isRunningStandalone(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const prompt = deferredPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  if (choice.outcome === "accepted") {
    deferredPrompt = null;
    notify();
  }
  return choice.outcome;
}

/** Subscribe to availability changes. Returns an unsubscribe function. */
export function onInstallPromptChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
