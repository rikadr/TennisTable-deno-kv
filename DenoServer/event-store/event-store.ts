import { getDb } from "../db.ts";
import { EventType } from "./event-types.ts";

export async function storeEvent(client: string, event: EventType) {
  const db = getDb(client);
  const latest = await db.getLatestEventTimestamp();
  if (latest && event.time <= latest) {
    console.error(`Event time ${event.time} is not after the latest event time ${latest}`);
    throw new Error();
  }

  await db.storeEvent(event);
}

export async function deleteEvent(client: string, time: number): Promise<boolean> {
  return getDb(client).deleteEvent(time);
}

export async function updateEvent(client: string, {
  oldEventTime,
  updatedEvent,
}: {
  oldEventTime: number;
  updatedEvent: EventType;
}): Promise<boolean> {
  return getDb(client).updateEvent(oldEventTime, updatedEvent);
}

export async function getEventsAfter(client: string, time: number): Promise<EventType[]> {
  return getDb(client).getEventsAfter(time);
}

export async function getLatestEventTimestamp(client: string): Promise<number | null> {
  return getDb(client).getLatestEventTimestamp();
}
