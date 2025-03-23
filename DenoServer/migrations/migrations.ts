import { getClientDbData } from "../client-db/client-db.ts";
import { storeEvent } from "../event-store/event-store.ts";
import {
  EventTypeEnum,
  GameCreated,
  PlayerCreated,
  PlayerDeactivated,
  TournamentSignup,
} from "../event-store/event-types.ts";
import { newId } from "../event-store/nano-id.ts";

type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY

export const migrations: Migration[] = [
  {
    name: "create-events-from-client-db",
    up: async () => {
      let lastTime = 0;
      function getNextTime() {
        return lastTime++;
      }

      const {
        players,
        games,
        tournament: { signedUp },
      } = await getClientDbData();

      const createPlayerEvents: Map<string, PlayerCreated> = new Map();
      const playersToDeactivate: Set<string> = new Set();
      const deactivatePlayersEvents: Map<string, PlayerDeactivated> = new Map();
      const createGameEvents: GameCreated[] = [];
      const tournamentSignupEvents: TournamentSignup[] = [];

      // Create player events
      for (const player of players) {
        createPlayerEvents.set(player.name, {
          time: getNextTime(),
          stream: newId(),
          type: EventTypeEnum.PLAYER_CREATED,
          data: { name: player.name },
        });
      }

      // Create game events
      const sortedGames = games.sort((a, b) => a.time - b.time);
      for (const game of sortedGames) {
        // Check if winner and loser exist
        for (const player of [game.winner, game.loser]) {
          if (!createPlayerEvents.has(player)) {
            createPlayerEvents.set(player, {
              time: getNextTime(),
              stream: newId(),
              type: EventTypeEnum.PLAYER_CREATED,
              data: { name: player },
            });
            playersToDeactivate.add(player);
          }
        }
        // Create the game
        createGameEvents.push({
          time: getNextTime(),
          stream: newId(),
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: game.time,
            winner: createPlayerEvents.get(game.winner)!.stream,
            loser: createPlayerEvents.get(game.loser)!.stream,
          },
        });
      }

      // Create tournament signup events
      const sortedSignedUp = signedUp.sort((a, b) => a.time - b.time);
      for (const signedUpPlayer of sortedSignedUp) {
        // Add player if not exists
        if (!createPlayerEvents.has(signedUpPlayer.player)) {
          createPlayerEvents.set(signedUpPlayer.player, {
            time: getNextTime(),
            stream: newId(),
            type: EventTypeEnum.PLAYER_CREATED,
            data: { name: signedUpPlayer.player },
          });
          playersToDeactivate.add(signedUpPlayer.player);
        }
        tournamentSignupEvents.push({
          time: getNextTime(),
          stream: signedUpPlayer.tournamentId,
          type: EventTypeEnum.TOURNAMENT_SIGNUP,
          data: { player: createPlayerEvents.get(signedUpPlayer.player)!.stream },
        });
      }

      // Deactivate players
      for (const player of playersToDeactivate) {
        deactivatePlayersEvents.set(player, {
          time: getNextTime(),
          stream: createPlayerEvents.get(player)!.stream,
          type: EventTypeEnum.PLAYER_DEACTIVATED,
          data: null,
        });
      }

      const allEvents = [
        ...createPlayerEvents.values(),
        ...deactivatePlayersEvents.values(),
        ...createGameEvents,
        ...tournamentSignupEvents,
      ].sort((a, b) => a.time - b.time);

      // Save events
      for (const event of allEvents) {
        await storeEvent(event);
      }
    },
  },
];
