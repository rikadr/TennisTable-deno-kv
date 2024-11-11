export type Player = { name: string };
export type Game = { winner: string; loser: string; time: number };

export type ClientDbDTO = { players: Player[]; games: Game[] };

export type PlayerWithElo = Player & { elo: number };
export type PlayerSummary = {
  name: string;
  elo: number;
  wins: number;
  loss: number;
  games: {
    time: number;
    result: "win" | "loss";
    oponent: string;
    eloAfterGame: number;
    pointsDiff: number;
  }[];
};

export type LeaderboardDTO = {
  rankedPlayers: (PlayerSummary & { rank: number })[];
  unrankedPlayers: PlayerSummary[];
};

export type PlayerSummaryDTO = PlayerSummary & {
  isRanked: boolean;
  rank?: number;
  streaks?: { longestWin: number; longestLose: number };
};

export type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

type Theme = "default" | "halloween";
export const CURRENT_THEME: Theme = "default";

export type Tournament = {
  id: string;
  name: string;
  startDate: number;
  playersSignedUp: string[];
  playerStarting: string[]; // To be set when tournament starts
  skippedGames: { eliminated: string; advancing: string }[];
};
