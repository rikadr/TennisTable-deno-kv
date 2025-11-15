import { TournamentCancelSignup, TournamentSignup, TournamentSkipGame, TournamentUndoSkipGame } from "../event-types";
import { ValidatorResponse } from "./validator-types";

type Tournament = {
  id: string;
  signups: Map<string, SignUp>;
  skippedGames: Map<string, SkippedGame>;
};

export type SignUp = {
  player: string;
  time: number;
};

export type SkippedGame = { skipId: string; winner: string; loser: string; time: number };

export class TournamentsProjector {
  #tournamentsMap = new Map<string, Tournament>();

  get tournaments() {
    return Array.from(this.#tournamentsMap.values());
  }

  getTournamentSkippedGames(tournamentId: string) {
    return Array.from(this.#tournamentsMap.get(tournamentId)?.skippedGames.values() ?? []);
  }

  getTournamentSignups(tournamentId: string) {
    return Array.from(this.#tournamentsMap.get(tournamentId)?.signups.values() ?? []);
  }

  #getOrCreateTournament(tournamentId: string) {
    const found = this.#tournamentsMap.get(tournamentId);
    if (found) {
      return found;
    }
    this.#tournamentsMap.set(tournamentId, { id: tournamentId, signups: new Map(), skippedGames: new Map() });
    return this.#tournamentsMap.get(tournamentId)!;
  }

  signup(event: TournamentSignup) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.signups.set(event.data.player, {
      player: event.data.player,
      time: event.time,
    });
  }
  validateSignup(event: TournamentSignup): ValidatorResponse {
    if (this.#tournamentsMap.get(event.stream)?.signups.has(event.data.player)) {
      return { valid: false, message: "Player already signed up" };
    }
    return { valid: true };
  }

  cancelSignup(event: TournamentCancelSignup) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.signups.delete(event.data.player);
  }
  validateCancelSignup(event: TournamentCancelSignup): ValidatorResponse {
    if (this.#tournamentsMap.get(event.stream)?.signups.has(event.data.player) !== true) {
      return { valid: false, message: "Player not signed up" };
    }
    return { valid: true };
  }

  skipGame(event: TournamentSkipGame) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.skippedGames.set(event.data.skipId, {
      skipId: event.data.skipId,
      winner: event.data.winner,
      loser: event.data.loser,
      time: event.time,
    });
  }
  validateSkipGame(event: TournamentSkipGame): ValidatorResponse {
    if (this.#tournamentsMap.get(event.stream)?.skippedGames.has(event.data.skipId)) {
      return { valid: false, message: "Game already skipped" };
    }
    // Would be nice to validate is after start date, but  tournament info is not event sourced yet
    return { valid: true };
  }

  undoSkipGame(event: TournamentUndoSkipGame) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.skippedGames.delete(event.data.skipId);
  }
  validateUndoSkipGame(event: TournamentUndoSkipGame): ValidatorResponse {
    if (this.#tournamentsMap.get(event.stream)?.skippedGames.has(event.data.skipId) !== true) {
      return { valid: false, message: "Game skip does not exist" };
    }
    return { valid: true };
  }
}
