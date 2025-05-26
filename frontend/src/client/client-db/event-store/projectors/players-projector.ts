import { PlayerCreated, PlayerDeactivated, PlayerNameUpdated, PlayerReactivated } from "../event-types";
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
    const nameValidation = this.validatePlayerName(event.data.name);
    if (nameValidation.valid === false) {
      return { valid: false, message: nameValidation.message };
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
    const player = this.#playersMap.get(event.stream);

    if (player === undefined) {
      return { valid: false, message: "Player does not exist" };
    }
    if (player.active === true) {
      return { valid: false, message: "Player is already active" };
    }
    return { valid: true };
  }

  updateName(event: PlayerNameUpdated) {
    const player = this.#playersMap.get(event.stream);
    if (player) {
      player.name = event.data.updatedName;
    }
  }

  validateUpdateName(event: PlayerNameUpdated): ValidatorResponse {
    const player = this.#playersMap.get(event.stream);
    if (player === undefined) {
      return { valid: false, message: "Player does not exist" };
    }
    if (player.name === event.data.updatedName) {
      return { valid: false, message: "Player name is already the same" };
    }
    const nameValidation = this.validatePlayerName(event.data.updatedName);
    if (nameValidation.valid === false) {
      return { valid: false, message: nameValidation.message };
    }
    return { valid: true };
  }

  validatePlayerName(name: string): ValidatorResponse {
    const players = Array.from(this.#playersMap.values());
    if (players.some((player) => player.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
      return { valid: false, message: "Player name already exists" };
    }
    const firstLetterIsUpperCase = name[0] === name[0]?.toUpperCase();
    if (firstLetterIsUpperCase === false) {
      return { valid: false, message: "First letter must be uppercase" };
    }
    const hasSpecialCharacters = /[!@#$%^&*()+=[\]{};':"\\|,.<>/?]+/.test(name);
    if (hasSpecialCharacters === true) {
      return { valid: false, message: "Name can not contain special or invalid characters." };
    }
    if (name.trim() !== name) {
      return { valid: false, message: "Name can not start or end with whitespaces" };
    }

    return { valid: true };
  }
}
