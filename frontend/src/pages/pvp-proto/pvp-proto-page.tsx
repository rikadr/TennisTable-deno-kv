import React from "react";
import { useSearchParams } from "react-router-dom";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { ConceptScoreboard } from "./concept-a-scoreboard";
import { ConceptTape } from "./concept-b-tape";
import { ConceptDashboard } from "./concept-c-dashboard";
import { usePvpData } from "./pvp-data";
import { usePlayerColors, useSelectPlayers } from "./pvp-ui";

/** Prototype of the new 1v1 page. Not for production */
export const PvpProtoPage: React.FC = () => {
  const { player1, player2 } = useTennisParams();
  const [searchParams] = useSearchParams();
  const variant = searchParams.get("variant") ?? "a";
  const data = usePvpData(player1 ?? undefined, player2 ?? undefined);
  const colors = usePlayerColors(player1 ?? undefined, player2 ?? undefined);
  const { select, swap } = useSelectPlayers();

  if (!data || data.games.length === 0) return <div className="p-8 text-primary-text">No games</div>;
  const props = { data, colors, select, swap: () => swap(player1 ?? undefined, player2 ?? undefined) };
  if (variant === "a") return <ConceptScoreboard {...props} />;
  if (variant === "b") return <ConceptTape {...props} />;
  return <ConceptDashboard {...props} />;
};
