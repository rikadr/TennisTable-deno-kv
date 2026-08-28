import { newId } from "../common/nani-id";

const DEVICE_ID_KEY = "tennis-table-device-id";

/**
 * A stable random id for this browser installation. It is sent with every
 * posted event and stored with the push subscription, so the server can skip
 * notifying the device that posted the event.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Storage can be unavailable (private mode). Fall back to a per-session id.
    return newId();
  }
}
