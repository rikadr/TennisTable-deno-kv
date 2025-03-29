import { kv } from "../db.ts";
import { EventType } from "./event-types.ts";

export async function storeEvent(event: EventType) {
  // Validate time is after the latest event time
  const latest = await getLatestEventTimestamp();
  if (latest && event.time <= latest) {
    console.error(`Event time ${event.time} is not after the latest event time ${latest}`);
    throw new Error();
  }
  // Store event
  const key = getEventKey(event.time);
  const result = await kv.atomic().check({ key, versionstamp: null }).set(key, event).commit();
  if (!result.ok) {
    console.error(`Failed to store event ${event}`);
    throw new Error();
  }
}

export async function getEventsAfter(time: number): Promise<EventType[]> {
  const events: EventType[] = [];
  // +1 to only get events after the given time
  const res = kv.list<EventType>({ prefix: getEventKey(), start: getEventKey(time + 1) });

  for await (const event of res) {
    events.push(event.value);
  }
  return events;
}

export async function getLatestEventTimestamp(): Promise<number | null> {
  const iter = kv.list({ prefix: getEventKey() }, { reverse: true, limit: 1 });
  const latest = (await iter.next()).value;

  if (!latest) {
    return null;
  }
  try {
    const [_, timestamp] = latest.key;
    return parseInt(timestamp as string);
  } catch (e) {
    console.error("Error parsing latest event timestamp", e);
    throw e;
  }
}

function getEventKey(time?: number) {
  const key: (string | number)[] = ["event"];
  if (time !== undefined) {
    key.push(time);
  }
  return key;
}
