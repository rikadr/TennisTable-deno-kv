import { TennisTable } from "./tennis-table";
import { Game } from "./event-store/projectors/games-projector";
import { Achievement } from "./achievements";
import { TournamentGamePlacement } from "./tournaments/tournament";

/** A notable fact about one game. The UI decides how each tag reads. */
export type GameTag =
  | { type: "tournament"; placement: TournamentGamePlacement }
  | { type: "achievement"; achievement: Achievement }
  /** The first game between the 2 players */
  | { type: "first-meeting" };

export class GameTags {
  private parent: TennisTable;
  /** Ids of the games that were the first between their pair of players. Built on the first read. */
  #firstMeetings: Set<string> | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  /** The tags of a game, in display order: tournament, first meeting, achievements */
  getTags(game: Game): GameTag[] {
    const tags: GameTag[] = [];

    for (const placement of this.parent.tournaments.findGamePlacements(game.playedAt)) {
      tags.push({ type: "tournament", placement });
    }

    if (this.isFirstMeeting(game)) {
      tags.push({ type: "first-meeting" });
    }

    for (const achievement of this.parent.achievements.getAchievementsEarnedByGame(game.id)) {
      tags.push({ type: "achievement", achievement });
    }

    return tags;
  }

  /** True when the game was the first between its 2 players */
  isFirstMeeting(game: Game): boolean {
    return this.#getFirstMeetings().has(game.id);
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
