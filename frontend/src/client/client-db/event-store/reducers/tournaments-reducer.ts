import { TournamentCancelSignup, TournamentSignup } from "../event-types";

type Tournament = {
  id: string;
  signups: Map<string, SignUp>;
};

type SignUp = {
  player: string;
  time: number;
};

export class TournamentsReducer {
  #tournamentsMap = new Map<string, Tournament>();

  get tournaments() {
    return Array.from(this.#tournamentsMap.values());
  }

  getTournamentSignups(tournamentId: string) {
    return Array.from(this.#tournamentsMap.get(tournamentId)?.signups.values() ?? []);
  }

  signup(event: TournamentSignup) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.signups.set(event.data.player, {
      player: event.data.player,
      time: event.time,
    });
  }

  cancelSignup(event: TournamentCancelSignup) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.signups.delete(event.stream);
  }

  #getOrCreateTournament(tournamentId: string) {
    const found = this.#tournamentsMap.get(tournamentId);
    if (found) {
      return found;
    }
    this.#tournamentsMap.set(tournamentId, { id: tournamentId, signups: new Map() });
    return this.#tournamentsMap.get(tournamentId)!;
  }
}
