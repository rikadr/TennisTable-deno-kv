import { useState } from "react";
import { Link } from "react-router-dom";
import { PointsRange } from "../../../client/client-db/individual-points";
import { fmtNum } from "../../../common/number-utils";
import { stringToColor } from "../../../common/string-to-color";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { relativeTimeString } from "../../../common/date-utils";
import { joinJSX } from "../../../common/join-JSX";
import { classNames } from "../../../common/class-names";
import { Elo } from "../../../client/client-db/elo";
import { Shimmer } from "../../../common/shimmer";

interface PointsBarProps {
  pointsRanges: PointsRange[];
  totalPoints: number;
  highestElo: number;
}

export const PointsBar: React.FC<PointsBarProps> = ({ pointsRanges, totalPoints, highestElo }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    range: PointsRange;
    rangePoints: number;
    percentage: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    range: { from: 0, to: 0, originPlayerId: "", transactions: [] },
    rangePoints: 0,
    percentage: 0,
  });

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLAnchorElement>,
    range: PointsRange,
    rangePoints: number,
    percentage: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      range,
      rangePoints,
      percentage,
    });
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const percentageHighestElo = (totalPoints / highestElo) * 100;
  return (
    <>
      <div
        className="h-8 flex rounded-lg overflow-hidden shadow-sm border border-primary-text shrink-0"
        style={{
          width: `${percentageHighestElo}%`,
        }}
      >
        {pointsRanges.map((range, index) => {
          const rangePoints = range.to - range.from;
          const percentageSelf = (rangePoints / totalPoints) * 100;
          return (
            <Shimmer
              key={index}
              intensity="strong"
              duration={1500}
              className="w-full h-full"
              style={{
                width: `${percentageSelf}%`,
              }}
              enabled={(range.from === 0 || range.to === Elo.INITIAL_ELO) && range.transactions.length > 1}
            >
              <Link
                to={`/simulations/individual-points/player?playerId=${range.originPlayerId}`}
                className={classNames(
                  "block w-full h-full transition-all duration-300 hover:brightness-125 cursor-pointer",
                )}
                style={{
                  backgroundColor: stringToColor(range.originPlayerId || "1adagrsss"),
                }}
                onMouseEnter={(e) => handleMouseEnter(e, range, rangePoints, percentageSelf)}
                onMouseLeave={handleMouseLeave}
              />
            </Shimmer>
          );
        })}
      </div>

      <Tooltip
        range={tooltip.range}
        rangePoints={tooltip.rangePoints}
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
      />
    </>
  );
};

interface TooltipProps {
  range: PointsRange;
  rangePoints: number;
  visible: boolean;
  x: number;
  y: number;
}

const Tooltip: React.FC<TooltipProps> = ({ range, rangePoints, visible, x, y }) => {
  const context = useEventDbContext();

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-primary-background text-primary-text ring-1 ring-primary-text text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
      style={{
        left: x,
        top: y - 8,
        maxWidth: `${200 + range.transactions.length * 15}px`,
      }}
    >
      <div className="font-semibold">Origin: {context.playerName(range.originPlayerId)}</div>
      <div>
        Range: {fmtNum(range.from)} - {fmtNum(range.to)}
      </div>
      <div>Points: {fmtNum(rangePoints)}</div>
      {range.transactions.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {joinJSX(
            range.transactions.map((t) => (
              <div
                className="px-1.5 rounded-full text-[0.7rem] flex items-center justify-center"
                style={{ background: stringToColor(t.recieverPlayerId) }}
              >
                {context.playerName(t.recieverPlayerId)}
              </div>
            )),
            <> → </>,
          )}
        </div>
      )}
      <div>{relativeTimeString(new Date(range.transactions[range.transactions.length - 1].time))}</div>
      {/* Triangle pointer */}
      <div className="absolute left-1/2 top-full transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-primary-text"></div>
    </div>
  );
};
