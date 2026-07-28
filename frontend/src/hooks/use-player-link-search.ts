import { useSearchParams } from "react-router-dom";

/**
 * Query string to hand a link pointing at another player's page. Carries the tab you are already
 * on, so following an opponent out of a tab keeps you in that tab instead of dropping you on
 * their Overview.
 */
export function usePlayerLinkSearch(): string {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  return tab ? `?tab=${tab}` : "";
}
