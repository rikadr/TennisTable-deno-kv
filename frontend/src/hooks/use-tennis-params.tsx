import { useSearchParams } from "react-router-dom";

const PLAYER_ID = "playerId";
const PLAYER_1 = "player1";
const PLAYER_2 = "player2";
const TOURNAMENT = "tournament";
const GAME_ID = "gameId";
const SEASON_START = "seasonStart";

export function useTennisParams() {
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get(PLAYER_ID);
  const player1 = searchParams.get(PLAYER_1);
  const player2 = searchParams.get(PLAYER_2);
  const tournament = searchParams.get(TOURNAMENT);
  const gameId = searchParams.get(GAME_ID);
  const seasonStart = searchParams.get(SEASON_START);

  return { playerId, player1, player2, tournament, gameId, seasonStart };
}
