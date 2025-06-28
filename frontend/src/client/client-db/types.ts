import { GameScore } from "./event-store/event-types";

export type PlayerSummary = {
  id: string;
  name: string;
  elo: number;
  wins: number;
  loss: number;
  games: {
    time: number;
    result?: "win" | "loss";
    oponent?: string;
    eloAfterGame: number;
    pointsDiff: number;
    score?: GameScore["data"];
  }[];
};

export type LeaderboardDTO = {
  rankedPlayers: (PlayerSummary & { rank: number })[];
  unrankedPlayers: PlayerSummary[];
};

export type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

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
