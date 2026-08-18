import React from "react";

/**
 * One name of a chart on the game details page, next to a sample of its line.
 * A player colour comes from the player id, so 2 players can be given close
 * colours. The dashed line of the second series carries the identity as well,
 * and never leaves it to the colour alone.
 */
export const ChartLegendKey: React.FC<{ color: string; name: string; dashed?: boolean }> = ({
  color,
  name,
  dashed,
}) => (
  <span className="flex items-center gap-1.5 min-w-0">
    <span
      className="w-4 h-0 shrink-0 border-t-2"
      style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
    />
    <span className="truncate">{name}</span>
  </span>
);
