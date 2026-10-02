import React from "react";
import { useSearchParams } from "react-router-dom";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { FocusedPillars, FocusedSplit } from "./focused";
import { usePvpData } from "./pvp-data";
import { usePlayerColors, useSelectPlayers } from "./pvp-ui";

/** Prototype of the new 1v1 page. Not for production */
export const PvpProtoPage: React.FC = () => {
  const { player1, player2 } = useTennisParams();
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("variant") ?? "1";
  const data = usePvpData(player1 ?? undefined, player2 ?? undefined);
  const colors = usePlayerColors(player1 ?? undefined, player2 ?? undefined);
  const { select, swap } = useSelectPlayers();

  if (!data || data.games.length === 0) return <div className="p-8 text-primary-text">No games</div>;
  const props = { data, colors, select, swap: () => swap(player1 ?? undefined, player2 ?? undefined) };
  if (variant === "2") return <FocusedSplit {...props} />;
  return <FocusedPillars {...props} />;
};
