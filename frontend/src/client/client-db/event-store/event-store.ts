import { EventTypeEnum } from "./event-types";
import { TennisTable } from "../tennis-table";
import { PlyersProjector } from "./reducers/players-projector";
import { GamesProjector } from "./reducers/games-projector";
import { TournamentsProjector } from "./reducers/tournaments-projector";

export class EventStore {
  private parent: TennisTable;
  readonly playersReducer: PlyersProjector;
  readonly gamesReducer: GamesProjector;
  readonly tournamentsReducer: TournamentsProjector;

  constructor(parent: TennisTable) {
    this.parent = parent;
    this.playersReducer = new PlyersProjector();
    this.gamesReducer = new GamesProjector();
    this.tournamentsReducer = new TournamentsProjector();

    this.#projectEvents();
  }

  #projectEvents() {
    this.parent.events.forEach((event) => {
      const { type } = event;
      switch (type) {
        case EventTypeEnum.PLAYER_CREATED:
          this.playersReducer.createPlayer(event);
          break;
        case EventTypeEnum.PLAYER_DEACTIVATED:
          this.playersReducer.deactivatePlayer(event);
          break;
        case EventTypeEnum.PLAYER_REACTIVATED:
          this.playersReducer.reactivatePlayer(event);
          break;
        case EventTypeEnum.GAME_CREATED:
          this.gamesReducer.createGame(event);
          break;
        case EventTypeEnum.GAME_DELETED:
          this.gamesReducer.deleteGame(event);
          break;
        case EventTypeEnum.TOURNAMENT_SIGNUP:
          this.tournamentsReducer.signup(event);
          break;
        case EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP:
          this.tournamentsReducer.cancelSignup(event);
          break;
        default:
          ((_: never) => {})(type); // exhaustive check
          break;
      }
    });
  }
}
