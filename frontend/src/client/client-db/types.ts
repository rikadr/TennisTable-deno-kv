export type Player = { name: string };
export type Game = { winner: string; loser: string; time: number };

export type ClientDbDTO = {
  players: Player[];
  games: Game[];
  tournament?: {
    signedUp: SignUpTournament[];
  };
};

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

export type TournamentDB = {
  id: string;
  name: string;
  description?: string;
  startDate: number;
  groupPlay: boolean;
  signedUp: SignUpTournament[];
  playerOrder?: string[]; // To be set when tournament starts
  skippedGames: { eliminated: string; advancing: string; time: number }[];
};
export type SignUpTournament = {
  tournamentId: string;
  player: string;
  time: number;
};
export type SignUpTournamentPayload = {
  tournamentId: string;
  player: string;
};
