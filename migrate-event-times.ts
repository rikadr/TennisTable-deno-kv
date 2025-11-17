// Copy pasted from the backend

export type EventTypeEnum =
  // Player events
  | "PLAYER_CREATED"
  | "PLAYER_DEACTIVATED"
  | "PLAYER_REACTIVATED"
  | "PLAYER_NAME_UPDATED"

  // Game events
  | "GAME_CREATED"
  | "GAME_UPDATED"
  | "GAME_DELETED"
  | "GAME_SCORE"

  // Tournament events
  | "TOURNAMENT_SIGNUP"
  | "TOURNAMENT_CANCEL_SIGNUP"
  | "TOURNAMENT_SKIP_GAME"
  | "TOURNAMENT_UNDO_SKIP_GAME";

type GenericEvent<Type extends EventTypeEnum = EventTypeEnum, Data = unknown> = {
  time: number; // Must be unique. Used as key in the KV store
  stream: string;
  type: Type;
  data: Data;
};

export type PlayerCreated = GenericEvent<"PLAYER_CREATED", { name: string }>;
export type PlayerDeactivated = GenericEvent<"PLAYER_DEACTIVATED", null>;
export type PlayerReactivated = GenericEvent<"PLAYER_REACTIVATED", null>;
export type PlayerNameUpdated = GenericEvent<"PLAYER_NAME_UPDATED", { updatedName: string }>;

export type GameCreated = GenericEvent<"GAME_CREATED", { playedAt: number; winner: string; loser: string }>;
export type GameDeleted = GenericEvent<"GAME_DELETED", null>;
export type GameScore = GenericEvent<
  "GAME_SCORE",
  { setsWon: { gameWinner: number; gameLoser: number }; setPoints?: { gameWinner: number; gameLoser: number }[] }
>;

export type TournamentSignup = GenericEvent<"TOURNAMENT_SIGNUP", { player: string }>;
export type TournamentCancelSignup = GenericEvent<"TOURNAMENT_CANCEL_SIGNUP", { player: string }>;
export type TournamentSkipGame = GenericEvent<
  "TOURNAMENT_SKIP_GAME",
  { skipId: string; winner: string; loser: string }
>;
export type TournamentUndoSkipGame = GenericEvent<"TOURNAMENT_UNDO_SKIP_GAME", { skipId: string }>;

export type EventType =
  | PlayerCreated
  | PlayerDeactivated
  | PlayerReactivated
  | PlayerNameUpdated
  | GameCreated
  | GameDeleted
  | GameScore
  | TournamentSignup
  | TournamentCancelSignup
  | TournamentSkipGame
  | TournamentUndoSkipGame;

export function updateEventTimes(events: EventType[]): EventType[] {
  // Map to track first game time for each player ID
  const playerFirstGameTime = new Map<string, number>();

  // First pass: collect playedAt times from GAME_CREATED events for each player
  events.forEach((event) => {
    if (event.type === "GAME_CREATED") {
      const gameEvent = event;
      const { playedAt, winner, loser } = gameEvent.data;

      // Track first appearance of each player in games (using player IDs)
      if (!playerFirstGameTime.has(winner)) {
        playerFirstGameTime.set(winner, playedAt);
      } else {
        playerFirstGameTime.set(winner, Math.min(playerFirstGameTime.get(winner)!, playedAt));
      }

      if (!playerFirstGameTime.has(loser)) {
        playerFirstGameTime.set(loser, playedAt);
      } else {
        playerFirstGameTime.set(loser, Math.min(playerFirstGameTime.get(loser)!, playedAt));
      }
    }
  });

  // Group players by their first game time to handle offsets
  const gameTimeToPlayers = new Map<number, string[]>();
  playerFirstGameTime.forEach((gameTime, playerId) => {
    if (!gameTimeToPlayers.has(gameTime)) {
      gameTimeToPlayers.set(gameTime, []);
    }
    gameTimeToPlayers.get(gameTime)!.push(playerId);
  });

  // Create a map of player ID to their offset time
  const playerOffsetTime = new Map<string, number>();
  gameTimeToPlayers.forEach((playerIds, gameTime) => {
    playerIds.forEach((playerId, index) => {
      playerOffsetTime.set(playerId, gameTime - (index + 1));
    });
  });

  // Counter for tournament signup events
  let tournamentSignupTime = 1732613400000;

  // Second pass: update event times
  return events
    .map((event) => {
      if (event.type === "GAME_CREATED") {
        const gameEvent = event as GameCreated;
        return {
          ...event,
          time: gameEvent.data.playedAt,
        };
      }

      if (event.type === "TOURNAMENT_SIGNUP") {
        const updatedEvent = {
          ...event,
          time: tournamentSignupTime,
        };
        tournamentSignupTime++; // Increment for next signup event
        return updatedEvent;
      }

      if (event.type === "PLAYER_CREATED") {
        const playerEvent = event as PlayerCreated;
        const playerId = playerEvent.stream; // Use stream as player ID
        const offsetTime = playerOffsetTime.get(playerId);

        if (offsetTime !== undefined) {
          return {
            ...event,
            time: offsetTime,
          };
        }
        // If player never played a game, keep original time
        return event;
      }

      if (event.type === "PLAYER_DEACTIVATED") {
        return {
          ...event,
          time: 1732709050000,
        };
      }

      // All other events keep their original time
      return event;
    })
    .sort((a, b) => a.time - b.time);
}
