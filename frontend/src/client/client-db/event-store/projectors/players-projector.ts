import { PlayerCreated, PlayerDeactivated, PlayerNameUpdated, PlayerReactivated } from "../event-types";
import { ValidatorResponse } from "./validator-types";

export type Player = {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  deactivatedAt: number | null;
  updateAction?: string;
};

type ActivationEvent = {
  time: number;
  active: boolean;
};

export class PlyersProjector {
  #playersMap = new Map<string, Player>();
  #activationHistory = new Map<string, ActivationEvent[]>();

  get activePlayers(): Player[] {
    return Array.from(this.#playersMap.values()).filter((player) => player.active);
  }

  get inactivePlayers(): Player[] {
    return Array.from(this.#playersMap.values()).filter((player) => player.active === false);
  }

  get allPlayers(): Player[] {
    return Array.from(this.#playersMap.values());
  }

  getPlayer(id: string): Player | undefined {
    return this.#playersMap.get(id);
  }

  /**
   * Checks if a player was active at a specific point in time
   * @param id Player ID
   * @param timestamp The timestamp to check
   * @returns true if the player was active at that time, false otherwise
   */
  wasPlayerActiveAt(id: string, timestamp: number): boolean {
    const player = this.#playersMap.get(id);
    if (!player) return false;

    const history = this.#activationHistory.get(id);
    if (!history || history.length === 0) return false;

    // Find the most recent activation event before or at the timestamp
    let activeStatus = false;
    for (const event of history) {
      if (event.time <= timestamp) {
        activeStatus = event.active;
      } else {
        break; // Events are in chronological order, so we can stop here
      }
    }

    return activeStatus;
  }

  createPlayer(event: PlayerCreated) {
    const player: Player = {
      id: event.stream,
      name: event.data.name,
      active: true,
      createdAt: event.time,
      updatedAt: event.time,
      deactivatedAt: null,
    };
    this.#playersMap.set(event.stream, player);

    // Track activation history
    this.#activationHistory.set(event.stream, [{ time: event.time, active: true }]);
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
      player.updatedAt = event.time;
      player.deactivatedAt = event.time;
      player.updateAction = "Deactivated";

      // Track activation history
      const history = this.#activationHistory.get(event.stream);
      if (history) {
        history.push({ time: event.time, active: false });
      }
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
      player.updatedAt = event.time;
      player.deactivatedAt = null;
      player.updateAction = "Re-activated";

      // Track activation history
      const history = this.#activationHistory.get(event.stream);
      if (history) {
        history.push({ time: event.time, active: true });
      }
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
      player.updateAction = "Name updated from " + player.name;
      player.name = event.data.updatedName;
      player.updatedAt = event.time;
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
    const nameValidation = this.validatePlayerName(event.data.updatedName, event.stream);
    if (nameValidation.valid === false) {
      return { valid: false, message: nameValidation.message };
    }
    return { valid: true };
  }

  validatePlayerName(name: string, ignorePlayerId?: string): ValidatorResponse {
    const players = Array.from(this.#playersMap.values());
    if (
      players.some(
        (player) =>
          player.id !== ignorePlayerId &&player.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() ,
      )
    ) {
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
