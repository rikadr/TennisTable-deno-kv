import { EventType, EventTypeEnum } from "./event-types";

/**
 * The events that make up the app state at a point in time. A game counts by
 * when it was played, and so does its score, also when a player stored or
 * changed the score later. Everything else counts by event time.
 */
export function eventsUpTo(events: EventType[], time: number): EventType[] {
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
