import { PlayerCreated, PlayerDeactivated, PlayerReactivated } from "../event-types";
import { ValidatorResponse } from "./validator-types";

type Player = { id: string; name: string; active: boolean };

export class PlyersReducer {
  #playersMap = new Map<string, Player>();

  get players(): Player[] {
    return Array.from(this.#playersMap.values());
  }

  createPlayer(event: PlayerCreated) {
    const player: Player = { id: event.stream, name: event.data.name, active: true };
    this.#playersMap.set(event.stream, player);
  }

  validateCreatePlayer(event: PlayerCreated): ValidatorResponse {
    const players = Array.from(this.#playersMap.values());
    if (this.#playersMap.has(event.stream)) {
      return { valid: false, message: "Player stream already exists" };
    }
    if (players.some((player) => player.name === event.data.name)) {
      return { valid: false, message: "Player name already exists" };
    }
    return { valid: true };
  }

  deactivatePlayer(event: PlayerDeactivated) {
    const player = this.#playersMap.get(event.stream);
    if (player) {
      player.active = false;
    }
  }

  validateDeactivatePlayer(event: PlayerDeactivated): ValidatorResponse {
    if (this.#playersMap.has(event.stream) === false) {
      return { valid: false, message: "Player does not exist" };
    }
    return { valid: true };
  }

  reactivatePlayer(event: PlayerReactivated) {
    const player = this.#playersMap.get(event.stream);
    if (player) {
      player.active = true;
    }
  }

  validateReactivatePlayer(event: PlayerReactivated): ValidatorResponse {
    if (this.#playersMap.has(event.stream) === false) {
      return { valid: false, message: "Player does not exist" };
    }
    return { valid: true };
  }
}
