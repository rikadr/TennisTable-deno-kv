import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { stringToColor } from "../../common/string-to-color";
import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId?: string;
};

export const OponentsScores: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();

  if (!playerId) return null;

  const { avgDiff, diffGraphData } = context.playerOponentDistribution.get(playerId);

  // Find the maximum count for scaling
  const maxCount = Math.max(...diffGraphData.map((entry) => entry.count));

  return (
    <div className="flex flex-col w-full">
      {/* Vertical Bar Chart */}
      <div className="flex items-end gap-0.5 h-64 pb-2">
        {diffGraphData.map((entry, i) => {
          const fraction = entry.count / maxCount;
          const barHeight = Math.max(fraction * 100, 0.5); // Minimum 0.5% height to be visible

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-end h-full"
              style={{ flex: `1 1 0px`, minWidth: 0 }}
            >
              {/* Bar */}
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${barHeight}%`,
                  minWidth: "2px",
                  backgroundColor: entry.diffGroup === 0 ? "rgb(var(--color-primary-text))" : stringToColor(playerId),
                }}
              />

              {/* Label - positioned below bar with fixed height */}
              <div
                className={classNames(
                  "h-5 text-[9px] text-primary-text whitespace-nowrap origin-bottom-left rotate-45 -translate-x-2 -translate-y-1.5",
                )}
              >
                {entry.diffGroup > 0 ? "+" : ""}
                {entry.diffGroup}
              </div>
            </div>
          );
        })}
      </div>
      {/* Header */}
      <div>
        <p className="text-sm text-primary-text/80">
          Average opponent score difference:{" "}
          <span className="font-semibold text-lg text-primary-text">
            {fmtNum(avgDiff, { digits: 0, signedPositive: true })}
          </span>
        </p>
      </div>
    </div>
  );
};
