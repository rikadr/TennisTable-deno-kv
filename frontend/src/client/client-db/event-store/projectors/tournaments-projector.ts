import {
  TournamentCancelSignup,
  TournamentCreated,
  TournamentDeleted,
  TournamentSetPlayerOrder,
  TournamentSignup,
  TournamentSkipGame,
  TournamentUndoSkipGame,
  TournamentUpdated,
} from "../event-types";
import { ValidatorResponse } from "./validator-types";

export type TournamentConfig = {
  id: string;
  name: string;
  description?: string;
  startDate: number;
  groupPlay: boolean;
  deleted: boolean;
  playerOrder?: string[];
};

type Tournament = {
  id: string;
  config: TournamentConfig;
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

  getTournamentConfigs(): TournamentConfig[] {
    return this.tournaments.filter((t) => !t.config.deleted).map((t) => t.config);
  }

  getTournamentConfig(tournamentId: string): TournamentConfig | undefined {
    const tournament = this.#tournamentsMap.get(tournamentId);
    if (!tournament || tournament.config.deleted) return undefined;
    return tournament.config;
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
    this.#tournamentsMap.set(tournamentId, {
      id: tournamentId,
      config: { id: tournamentId, name: "", startDate: 0, groupPlay: false, deleted: false },
      signups: new Map(),
      skippedGames: new Map(),
    });
    return this.#tournamentsMap.get(tournamentId)!;
  }

  // ---- Tournament CRUD ----

  createTournament(event: TournamentCreated) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.config = {
      id: event.stream,
      name: event.data.name,
      description: event.data.description,
      startDate: event.data.startDate,
      groupPlay: event.data.groupPlay,
      deleted: false,
    };
  }
  validateCreateTournament(event: TournamentCreated): ValidatorResponse {
    const existing = this.#tournamentsMap.get(event.stream);
    if (existing) {
      return { valid: false, message: "Tournament with this ID already exists" };
    }
    if (!event.data.name.trim()) {
      return { valid: false, message: "Tournament name is required" };
    }
    if (!event.data.startDate) {
      return { valid: false, message: "Start date is required" };
    }
    return { valid: true };
  }

  updateTournament(event: TournamentUpdated) {
    const tournament = this.#getOrCreateTournament(event.stream);
    if (event.data.name !== undefined) tournament.config.name = event.data.name;
    if (event.data.description !== undefined) tournament.config.description = event.data.description;
    if (event.data.startDate !== undefined) tournament.config.startDate = event.data.startDate;
    if (event.data.groupPlay !== undefined) tournament.config.groupPlay = event.data.groupPlay;
  }
  validateUpdateTournament(event: TournamentUpdated): ValidatorResponse {
    const existing = this.#tournamentsMap.get(event.stream);
    if (!existing || existing.config.deleted) {
      return { valid: false, message: "Tournament does not exist" };
    }
    if (existing.config.deleted) {
      return { valid: false, message: "Tournament is deleted" };
    }
    const hasStarted = existing.config.startDate <= Date.now();
    if (hasStarted && event.data.startDate !== undefined) {
      return { valid: false, message: "Cannot change start date after tournament has started" };
    }
    if (hasStarted && event.data.groupPlay !== undefined) {
      return { valid: false, message: "Cannot change group play setting after tournament has started" };
    }
    if (event.data.name !== undefined && !event.data.name.trim()) {
      return { valid: false, message: "Tournament name cannot be empty" };
    }
    return { valid: true };
  }

  deleteTournament(event: TournamentDeleted) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.config.deleted = true;
  }
  validateDeleteTournament(event: TournamentDeleted): ValidatorResponse {
    const existing = this.#tournamentsMap.get(event.stream);
    if (!existing || existing.config.deleted) {
      return { valid: false, message: "Tournament does not exist" };
    }
    return { valid: true };
  }

  setPlayerOrder(event: TournamentSetPlayerOrder) {
    const tournament = this.#getOrCreateTournament(event.stream);
    tournament.config.playerOrder = event.data.playerOrder;
  }
  validateSetPlayerOrder(event: TournamentSetPlayerOrder): ValidatorResponse {
    const existing = this.#tournamentsMap.get(event.stream);
    if (!existing || existing.config.deleted) {
      return { valid: false, message: "Tournament does not exist" };
    }
    if (!event.data.playerOrder || event.data.playerOrder.length === 0) {
      return { valid: false, message: "Player order cannot be empty" };
    }
    return { valid: true };
  }

  // ---- Signup / Skip ----

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
    if ((this.#tournamentsMap.get(event.stream)?.config.startDate || 0) < Date.now()) {
      return { valid: false, message: "Cannot sign up after tournament has started" };
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
    if ((this.#tournamentsMap.get(event.stream)?.config.startDate || Infinity) > Date.now()) {
      return { valid: false, message: "Cannot skip games before tournament has started" };
    }
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
