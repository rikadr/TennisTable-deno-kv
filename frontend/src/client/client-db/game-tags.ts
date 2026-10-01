import { TennisTable } from "./tennis-table";
import { Game } from "./event-store/projectors/games-projector";
import { Achievement } from "./achievements";
import { TournamentGamePlacement } from "./tournaments/tournament";

/** A winner with at least this much less Elo than the loser before the game makes the game an upset */
export const UPSET_ELO_GAP = 100;

/** A notable fact about one game. The UI decides how each tag reads. */
export type GameTag =
  | { type: "tournament"; placement: TournamentGamePlacement }
  | { type: "achievement"; achievement: Achievement }
  /** `eloGap` is how much more Elo the loser had than the winner just before the game */
  | { type: "upset"; eloGap: number }
  /** The first game between the 2 players */
  | { type: "first-meeting" }
  /** The winner lost the first set */
  | { type: "comeback" };

export class GameTags {
  private parent: TennisTable;
  /** Ids of the games that were the first between their pair of players. Built on the first read. */
  #firstMeetings: Set<string> | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  /** The tags of a game, in display order: tournament, upset, first meeting, comeback, achievements */
  getTags(game: Game): GameTag[] {
    const tags: GameTag[] = [];

    for (const placement of this.parent.tournaments.findGamePlacements(game.playedAt)) {
      tags.push({ type: "tournament", placement });
    }

    const eloGap = this.#eloGapBeforeGame(game);
    if (eloGap !== undefined && eloGap >= UPSET_ELO_GAP) {
      tags.push({ type: "upset", eloGap });
    }

    if (this.#getFirstMeetings().has(game.id)) {
      tags.push({ type: "first-meeting" });
    }

    const firstSet = game.score?.setPoints?.[0];
    if (firstSet && firstSet.gameWinner < firstSet.gameLoser) {
      tags.push({ type: "comeback" });
    }

    for (const achievement of this.parent.achievements.getAchievementsEarnedByGame(game.id)) {
      tags.push({ type: "achievement", achievement });
    }

    return tags;
  }

  /** The loser's Elo minus the winner's Elo just before the game. Undefined when a player has no Elo log entry */
  #eloGapBeforeGame(game: Game): number | undefined {
    const leaderboardMap = this.parent.leaderboard.getCachedLeaderboardMap();
    const winnerEntry = leaderboardMap.get(game.winner)?.games.find((g) => g.time === game.playedAt);
    const loserEntry = leaderboardMap.get(game.loser)?.games.find((g) => g.time === game.playedAt);
    if (!winnerEntry || !loserEntry) return undefined;
    const winnerEloBefore = winnerEntry.eloAfterGame - winnerEntry.pointsDiff;
    const loserEloBefore = loserEntry.eloAfterGame - loserEntry.pointsDiff;
    return loserEloBefore - winnerEloBefore;
  }

  #getFirstMeetings(): Set<string> {
    if (this.#firstMeetings === undefined) {
      const seenPairs = new Set<string>();
      const firstMeetings = new Set<string>();
      for (const game of this.parent.games) {
        const pair = [game.winner, game.loser].sort().join(":");
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        firstMeetings.add(game.id);
      }
      this.#firstMeetings = firstMeetings;
    }
    return this.#firstMeetings;
  }
}
