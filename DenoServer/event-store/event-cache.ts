import { kv } from "../db.ts";
import { EventType } from "./event-types.ts";

type EventCacheData = { events: EventType[] };
type EventCacheBatch = { batchIndex: number; totalBatches: number; timeCreated: number; value: string };

/** Deprecated, to be removed */
export class EventCache {
  async clearCache(): Promise<void> {
    const cacheBatches = kv.list<EventCacheBatch>({ prefix: this.#getCacheKey() });
    for await (const cache of cacheBatches) {
      const key = this.#getCacheKey(cache.value.batchIndex);
      await kv.delete(key);
    }
  }

  #getCacheKey(index?: number): string[] {
    const key = ["event-cache"];
    if (index === undefined) {
      return key;
    }
    key.push("batch-index-" + index);
    return key;
  }
}
