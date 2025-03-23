import { EventTypeEnum } from "./event-types";
import { TennisTable } from "../tennis-table";
import { PlyersReducer } from "./reducers/players-reducer";
import { GamesReducer } from "./reducers/games-reducer";
import { TournamentsReducer } from "./reducers/tournaments-reducer";
import { Game, Player, SignUpTournament } from "../types";

export class EventStore {
  private parent: TennisTable;
  private playersReducer: PlyersReducer;
  private gamesReducer: GamesReducer;
  private tournamentsReducer: TournamentsReducer;

  constructor(parent: TennisTable) {
    this.parent = parent;
    this.playersReducer = new PlyersReducer();
    this.gamesReducer = new GamesReducer();
    this.tournamentsReducer = new TournamentsReducer();

    this.#reduceEvents();
  }

  #reduceEvents() {
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

  get oldTypePlayers(): Player[] {
    return this.playersReducer.players.filter((player) => player.active).map((player) => ({ name: player.name }));
  }

  get oldTypeGames(): Game[] {
    return this.gamesReducer.games.map((game) => ({
      winner: game.winner,
      loser: game.loser,
      time: game.playedAt,
    }));
  }

  get oldTypeTournamentSignups(): SignUpTournament[] {
    const signups: SignUpTournament[] = [];
    this.tournamentsReducer.tournaments.forEach((tournament) => {
      tournament.signups.forEach((signup) => {
        signups.push({
          player: signup.player,
          time: signup.time,
          tournamentId: tournament.id,
        });
      });
    });
    return signups;
  }
}
