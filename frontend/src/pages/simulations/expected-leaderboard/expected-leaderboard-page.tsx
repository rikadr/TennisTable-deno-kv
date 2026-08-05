import { useLayoutEffect, useRef, useState } from "react";
import { classNames } from "../../../common/class-names";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import { fmtNum } from "../../../common/number-utils";
import { useExpectedLeaderboardWorker } from "../../../hooks/use-expected-leaderboard-worker";

type Entry = { id: string; rank: number; score: number };
type Line = { id: string; y1: number; y2: number; change: number };

const lineColor = (change: number): string => {
  if (change > 0) return "#22c55e"; // green
  if (change < 0) return "#ef4444"; // red
  return "#9ca3af"; // gray
};

const PlayerRow: React.FC<{
  player: Entry;
  rankChange?: number;
  scoreChange?: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
}> = ({ player, rankChange, scoreChange, hovered, onHover }) => {
  const context = useEventDbContext();

  return (
    <div
      onMouseEnter={() => onHover(player.id)}
      onMouseLeave={() => onHover(null)}
      className={classNames(
        "h-12 md:h-16 px-1.5 md:px-3 rounded-lg ring-1 flex items-center gap-1.5 md:gap-3 text-primary-text transition-all duration-150",
        hovered ? "ring-primary-text/50 bg-primary-text/5" : "ring-primary-text/15",
      )}
    >
      <span className="shrink-0 w-5 md:w-8 text-xs md:text-base font-bold text-primary-text/60">#{player.rank}</span>
      <div className="shrink-0 md:hidden">
        <ProfilePicture playerId={player.id} size={32} border={2} shape="rounded" linkToPlayer />
      </div>
      <div className="shrink-0 hidden md:block">
        <ProfilePicture playerId={player.id} size={44} border={3} shape="rounded" linkToPlayer />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs md:text-base leading-tight font-medium">{context.playerName(player.id)}</div>
        <div className="text-[10px] md:text-sm text-primary-text/60">{fmtNum(player.score)}</div>
      </div>
      {(rankChange !== undefined || scoreChange !== undefined) && (
        <div className="shrink-0 flex flex-col items-end leading-tight">
          {rankChange !== undefined && rankChange !== 0 && (
            <span
              className={classNames(
                "text-[10px] md:text-sm font-semibold",
                rankChange > 0 ? "text-green-500" : "text-red-500",
              )}
            >
              {rankChange > 0 ? "▲" : "▼"} {Math.abs(rankChange)}
            </span>
          )}
          {scoreChange !== undefined && scoreChange !== 0 && (
            <span
              className={classNames("text-[9px] md:text-xs", scoreChange > 0 ? "text-green-500/80" : "text-red-500/80")}
            >
              {fmtNum(scoreChange, { signedPositive: true })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const SimulatedLeaderboard: React.FC = () => {
  const { result, progress } = useExpectedLeaderboardWorker();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentListRef = useRef<HTMLDivElement>(null);
  const expectedListRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!result) return;

    const measure = () => {
      const middle = middleRef.current;
      const currentList = currentListRef.current;
      const expectedList = expectedListRef.current;
      if (!middle || !currentList || !expectedList) return;

      const middleRect = middle.getBoundingClientRect();
      const newLines: Line[] = [];

      result.current.forEach((player, index) => {
        const expectedIndex = result.expected.findIndex((p) => p.id === player.id);
        if (expectedIndex === -1) return;
        const currentEl = currentList.children[index] as HTMLElement | undefined;
        const expectedEl = expectedList.children[expectedIndex] as HTMLElement | undefined;
        if (!currentEl || !expectedEl) return;

        const currentRect = currentEl.getBoundingClientRect();
        const expectedRect = expectedEl.getBoundingClientRect();
        newLines.push({
          id: player.id,
          y1: currentRect.top + currentRect.height / 2 - middleRect.top,
          y2: expectedRect.top + expectedRect.height / 2 - middleRect.top,
          change: player.rank - result.expected[expectedIndex].rank,
        });
      });
      setLines(newLines);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [result]);

  if (!result) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-primary-background rounded-lg text-center">
        <h1 className="text-xl md:text-2xl text-primary-text">Expected leaderboard</h1>
        <p className="text-primary-text/60 text-sm mt-2 mb-6">Simulating 5 000 leaderboards…</p>
        <div className="h-2.5 w-full rounded-full bg-primary-text/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary-background transition-all duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-primary-text/60 text-xs mt-2">{Math.round(progress * 100)} %</p>
      </div>
    );
  }

  if (result.expected.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-primary-background rounded-lg text-center">
        <h1 className="text-xl md:text-2xl text-primary-text">Expected leaderboard</h1>
        <p className="text-primary-text/60 text-sm mt-2">Not enough ranked players to simulate a leaderboard.</p>
      </div>
    );
  }

  const currentById = new Map(result.current.map((player) => [player.id, player]));

  // Draw the hovered line last so it sits on top
  const orderedLines = hoveredId
    ? [...lines.filter((l) => l.id !== hoveredId), ...lines.filter((l) => l.id === hoveredId)]
    : lines;

  return (
    <div className="max-w-5xl mx-auto bg-primary-background rounded-lg p-2 md:p-4">
      <h1 className="text-xl md:text-2xl text-center text-primary-text pt-2">Expected leaderboard</h1>
      <p className="text-center text-primary-text/60 text-xs md:text-sm mt-1 mb-4 max-w-xl mx-auto">
        The average of 5 000 simulated leaderboards where every ranked player plays every other player. The difference
        from today shows the effect of the schedule.
      </p>

      <div ref={containerRef} className="grid grid-cols-[1fr_44px_1fr] xs:grid-cols-[1fr_90px_1fr] md:grid-cols-[1fr_150px_1fr]">
        {/* Current leaderboard */}
        <div>
          <h2 className="text-sm md:text-lg font-bold text-primary-text mb-2 md:mb-3 text-center">Today</h2>
          <div ref={currentListRef} className="space-y-1.5 md:space-y-2">
            {result.current.map((player) => (
              <PlayerRow key={player.id} player={player} hovered={hoveredId === player.id} onHover={setHoveredId} />
            ))}
          </div>
        </div>

        {/* Connection lines */}
        <div ref={middleRef} className="relative">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {orderedLines.map((line) => {
              const isHovered = hoveredId === line.id;
              const isDimmed = hoveredId !== null && !isHovered;
              return (
                <line
                  key={line.id}
                  x1="0"
                  y1={line.y1}
                  x2="100%"
                  y2={line.y2}
                  stroke={lineColor(line.change)}
                  strokeWidth={isHovered ? 4 : 2.5}
                  strokeOpacity={isHovered ? 1 : isDimmed ? 0.1 : 1}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        </div>

        {/* Expected leaderboard */}
        <div>
          <h2 className="text-sm md:text-lg font-bold text-primary-text mb-2 md:mb-3 text-center">Expected</h2>
          <div ref={expectedListRef} className="space-y-1.5 md:space-y-2">
            {result.expected.map((player) => {
              const current = currentById.get(player.id);
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rankChange={current ? current.rank - player.rank : undefined}
                  scoreChange={current ? player.score - current.score : undefined}
                  hovered={hoveredId === player.id}
                  onHover={setHoveredId}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
