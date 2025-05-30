import { useState } from "react";
import { Link } from "react-router-dom";
import { PointsRange } from "../../../client/client-db/individual-points";
import { fmtNum } from "../../../common/number-utils";
import { stringToColor } from "../../../common/string-to-color";
import { useEventDbContext } from "../../../wrappers/event-db-context";

interface PointsBarProps {
  pointsRanges: PointsRange[];
  totalPoints: number;
  highestElo: number;
  showPercentageInTooltip?: boolean;
}

export const PointsBar: React.FC<PointsBarProps> = ({
  pointsRanges,
  totalPoints,
  highestElo,
  showPercentageInTooltip = true,
}) => {
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
    range: { from: 0, to: 0, originPlayerId: "" },
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
        className="h-8 flex rounded-lg overflow-hidden shadow-sm border border-primary-text"
        style={{
          width: `${percentageHighestElo}%`,
        }}
      >
        {pointsRanges.map((range, index) => {
          const rangePoints = range.to - range.from;
          const percentageSelf = (rangePoints / totalPoints) * 100;

          return (
            <Link
              key={index}
              to={`/simulations/individual-points/player?playerId=${range.originPlayerId}`}
              className="transition-all duration-300 hover:brightness-125 cursor-pointer"
              style={{
                width: `${percentageSelf}%`,
                backgroundColor: stringToColor(range.originPlayerId || "1adagrsss"),
              }}
              onMouseEnter={(e) => handleMouseEnter(e, range, rangePoints, percentageSelf)}
              onMouseLeave={handleMouseLeave}
            ></Link>
          );
        })}
      </div>

      <Tooltip
        range={tooltip.range}
        rangePoints={tooltip.rangePoints}
        percentage={showPercentageInTooltip ? tooltip.percentage : undefined}
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
  percentage?: number;
  visible: boolean;
  x: number;
  y: number;
}

const Tooltip: React.FC<TooltipProps> = ({ range, rangePoints, percentage, visible, x, y }) => {
  const context = useEventDbContext();

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-primary-background text-primary-text ring-1 ring-primary-text text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
      style={{
        left: x,
        top: y - 8,
        maxWidth: "200px",
      }}
    >
      <div className="font-semibold">From: {context.playerName(range.originPlayerId)}</div>
      <div className="text-primary-text">
        Range: {fmtNum(range.from)} - {fmtNum(range.to)}
      </div>
      <div className="text-primary-text">
        Points: {fmtNum(rangePoints)} {percentage && `(${percentage.toFixed(1)}%)`}
      </div>
      {/* Triangle pointer */}
      <div className="absolute left-1/2 top-full transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-primary-text"></div>
    </div>
  );
};
