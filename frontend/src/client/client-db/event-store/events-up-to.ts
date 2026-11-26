import { EventType, EventTypeEnum } from "./event-types";

/** The events that make up the app state at a point in time.
 * Games count by when they were played, everything else by event time. */
export function eventsUpTo(events: EventType[], time: number): EventType[] {
  return events.filter((event) => {
    if (event.type === EventTypeEnum.GAME_CREATED) {
      return event.data.playedAt <= time;
    }
    return event.time <= time;
  });
}

/**
 * The events that make up the app state at a point in time, for the states
 * around a game. A score counts at the time its game was played, also when a
 * player stored or changed it later. Then a game shows the same score before
 * and after other games, as it does in the live state.
 */
export function eventsUpToByGameTime(events: EventType[], time: number): EventType[] {
  const playedAtOfGame = new Map<string, number>();
  for (const event of events) {
    if (event.type === EventTypeEnum.GAME_CREATED) playedAtOfGame.set(event.stream, event.data.playedAt);
  }
  return events.filter((event) => {
    if (event.type === EventTypeEnum.GAME_CREATED) return event.data.playedAt <= time;
    if (event.type === EventTypeEnum.GAME_SCORE) {
      const playedAt = playedAtOfGame.get(event.stream);
      return playedAt === undefined ? event.time <= time : playedAt <= time;
    }
    return event.time <= time;
  });
}
