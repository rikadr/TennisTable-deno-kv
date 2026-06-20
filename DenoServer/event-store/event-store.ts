import { db } from "../db.ts";
import { EventType } from "./event-types.ts";

export async function storeEvent(event: EventType) {
  const latest = await db.getLatestEventTimestamp();
  if (latest && event.time <= latest) {
    console.error(`Event time ${event.time} is not after the latest event time ${latest}`);
    throw new Error();
  }

  await db.storeEvent(event);
}

export async function deleteEvent(time: number): Promise<boolean> {
  return db.deleteEvent(time);
}

export async function updateEvent({
  oldEventTime,
  updatedEvent,
}: {
  oldEventTime: number;
  updatedEvent: EventType;
}): Promise<boolean> {
  return db.updateEvent(oldEventTime, updatedEvent);
}

export async function getEventsAfter(time: number): Promise<EventType[]> {
  return db.getEventsAfter(time);
}

export async function getLatestEventTimestamp(): Promise<number | null> {
  return db.getLatestEventTimestamp();
}
