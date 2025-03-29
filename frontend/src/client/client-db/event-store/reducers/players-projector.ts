import { PlayerCreated, PlayerDeactivated, PlayerReactivated } from "../event-types";
import { ValidatorResponse } from "./validator-types";

export type Player = { id: string; name: string; active: boolean };

export class PlyersProjector {
  #playersMap = new Map<string, Player>();

  get players(): Player[] {
    return Array.from(this.#playersMap.values()).filter((player) => player.active);
  }

  get inactivePlayers(): Player[] {
    return Array.from(this.#playersMap.values()).filter((player) => player.active === false);
  }

  getPlayer(id: string): Player | undefined {
    return this.#playersMap.get(id);
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
    const player = this.#playersMap.get(event.stream);
    if (player === undefined) {
      return { valid: false, message: "Player does not exist" };
    }
    if (player.active === false) {
      return { valid: false, message: "Player is already inactive" };
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
