import { EventTypeEnum } from "./event-types";
import { TennisTable } from "../tennis-table";
import { PlyersProjector } from "./reducers/players-projector";
import { GamesProjector } from "./reducers/games-projector";
import { TournamentsProjector } from "./reducers/tournaments-projector";

export class EventStore {
  private parent: TennisTable;
  readonly playersProjector: PlyersProjector;
  readonly gamesProjector: GamesProjector;
  readonly tournamentsProjector: TournamentsProjector;

  constructor(parent: TennisTable) {
    this.parent = parent;
    this.playersProjector = new PlyersProjector();
    this.gamesProjector = new GamesProjector();
    this.tournamentsProjector = new TournamentsProjector();

    this.#projectEvents();
  }

  #projectEvents() {
    this.parent.events.forEach((event) => {
      const { type } = event;
      switch (type) {
        case EventTypeEnum.PLAYER_CREATED:
          this.playersProjector.createPlayer(event);
          break;
        case EventTypeEnum.PLAYER_DEACTIVATED:
          this.playersProjector.deactivatePlayer(event);
          break;
        case EventTypeEnum.PLAYER_REACTIVATED:
          this.playersProjector.reactivatePlayer(event);
          break;
        case EventTypeEnum.PLAYER_NAME_UPDATED:
          this.playersProjector.updateName(event);
          break;
        case EventTypeEnum.GAME_CREATED:
          this.gamesProjector.createGame(event);
          break;
        case EventTypeEnum.GAME_DELETED:
          this.gamesProjector.deleteGame(event);
          break;
        case EventTypeEnum.TOURNAMENT_SIGNUP:
          this.tournamentsProjector.signup(event);
          break;
        case EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP:
          this.tournamentsProjector.cancelSignup(event);
          break;
        default:
          ((_: never) => {})(type); // exhaustive check
          break;
      }
    });
  }
}
