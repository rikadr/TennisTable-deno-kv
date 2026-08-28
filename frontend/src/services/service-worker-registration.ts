import { getDeviceId } from "./device-id";

/**
 * Registers the service worker that makes the app installable and receives
 * push notifications. Called once from index.tsx.
 *
 * The registration URL carries the API base url and the device id as query
 * params, because the service worker needs them to re-register the push
 * subscription when the browser rotates it (see public/service-worker.js).
 * A change to either produces a new URL, which the browser treats as an
 * updated service worker.
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const params = new URLSearchParams();
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    if (apiBaseUrl) params.set("apiBaseUrl", apiBaseUrl);
    params.set("deviceId", getDeviceId());

    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js?${params.toString()}`)
      .catch((error) => console.error("Service worker registration failed", error));
  });
}
