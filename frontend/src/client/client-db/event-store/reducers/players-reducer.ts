import { PlayerCreated, PlayerDeactivated, PlayerReactivated } from "../event-types";

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
  deactivatePlayer(event: PlayerDeactivated) {
    const player = this.#playersMap.get(event.stream);
    if (player) {
      player.active = false;
    }
  }
  reactivatePlayer(event: PlayerReactivated) {
    const player = this.#playersMap.get(event.stream);
    if (player) {
      player.active = true;
    }
  }
}
