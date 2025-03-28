import { TournamentCancelSignup, TournamentSignup } from "../event-types";
import { ValidatorResponse } from "./validator-types";

type Tournament = {
  id: string;
  signups: Map<string, SignUp>;
};

export type SignUp = {
  player: string;
  time: number;
};

export class TournamentsProjector {
  #tournamentsMap = new Map<string, Tournament>();

  get tournaments() {
    return Array.from(this.#tournamentsMap.values());
  }

  getTournamentSignups(tournamentId: string) {
    return Array.from(this.#tournamentsMap.get(tournamentId)?.signups.values() ?? []);
  }

  #getOrCreateTournament(tournamentId: string) {
    const found = this.#tournamentsMap.get(tournamentId);
    if (found) {
      return found;
    }
    this.#tournamentsMap.set(tournamentId, { id: tournamentId, signups: new Map() });
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
}
