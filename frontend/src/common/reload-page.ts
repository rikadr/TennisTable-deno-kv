/**
 * Wrapper around window.location.reload so components that trigger a reload
 * can be unit tested (jsdom does not allow mocking window.location directly).
 */
export function reloadPage(): void {
  window.location.reload();
}
