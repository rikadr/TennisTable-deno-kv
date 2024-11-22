import { useSearchParams } from "react-router-dom";

const PLAYER_1 = "player1";
const PLAYER_2 = "player2";
const TOURNAMENT = "tournament";

export function useTennisParams() {
  const [searchParams] = useSearchParams();
  const player1 = searchParams.get(PLAYER_1);
  const player2 = searchParams.get(PLAYER_2);
  const tournament = searchParams.get(TOURNAMENT);

  return { player1, player2, tournament };
}
