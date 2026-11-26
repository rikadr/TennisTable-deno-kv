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
 * The events that make up the app state just after a game: the events up to
 * 1 ms after it, and the score of the game also when it was stored later.
 * A score arrives later when a save was retried after other events, or when a
 * player adds the score on the edit page. The other events stored before that
 * score stay out, so the state shows this game only.
 */
export function eventsAfterGame(events: EventType[], playedAt: number): EventType[] {
  const time = playedAt + 1;
  const gameIds = new Set(
    events
      .filter((event) => event.type === EventTypeEnum.GAME_CREATED && event.data.playedAt === playedAt)
      .map((event) => event.stream),
  );
  // Every score event of the game, in stored order, so a later edit replaces
  // an earlier score the same way it does in the live state.
  const lateScores = events
    .filter((event) => event.type === EventTypeEnum.GAME_SCORE && gameIds.has(event.stream) && event.time > time)
    .map((event) => ({ ...event, time }));
  return [...eventsUpTo(events, time), ...lateScores];
}
