import { useEventDbContext } from "../wrappers/event-db-context";

/** Shows a message until the web worker has calculated the achievements, then the children */
export const WaitForAchievements: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useEventDbContext();
  if (!context.achievements.isReady) {
    return <p className="w-full text-center py-8 text-sm text-primary-text/60">Calculating achievements…</p>;
  }
  return <>{children}</>;
};
