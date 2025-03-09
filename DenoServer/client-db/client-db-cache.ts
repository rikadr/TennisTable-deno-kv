import { kv } from "../db.ts";
import { getClientDbData } from "./client-db.ts";

type CacheValue = { index: number; total: number; time: number; value: string };

export class ClientDBCacheManager {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1_000; // Time to live in ms
  private readonly MAX_CACHE_BATCH_SIZE = 60_000; // Max value size of 64 KiB, I minus some overhead and for metadata

  async getCache() {
    const cacheBatches = await this.getAllCacheBatches();
    if (cacheBatches.length === 0) {
      return null;
    }
    if (cacheBatches[0].time + this.CACHE_TTL < new Date().getTime()) {
      await this.clearCache();
      return null;
    }
    return this.parceCacheBatches(cacheBatches);
  }

  async setCache(value: unknown) {
    await this.clearCache();
    const cacheBatches = this.createCacheBatches(value);
    await this.uploadCacheBatches(cacheBatches);
  }

  async reloadCache() {
    await this.clearCache();
    const response = await getClientDbData();
    await this.setCache(response);
  }

  async clearCache() {
    const cacheBatches = kv.list<CacheValue>({ prefix: this.getCacheKey() });
    for await (const cache of cacheBatches) {
      const key = this.getCacheKey(cache.value.index);
      await kv.delete(key);
    }
  }

  private async getAllCacheBatches(): Promise<CacheValue[]> {
    const cacheBatches: CacheValue[] = [];
    let breakWhile = false;

    while (!breakWhile) {
      const result = await kv.get<CacheValue>(this.getCacheKey(cacheBatches.length));
      if (!result.value) {
        breakWhile = true;
        continue;
      }
      if (result.value.index === result.value.index - 1) {
        // Last batch
        breakWhile = true;
      }
      cacheBatches.push(result.value);
    }
    return cacheBatches;
  }

  private parceCacheBatches(cacheBatches: CacheValue[]) {
    cacheBatches.sort((a, b) => a.index - b.index);
    const value = cacheBatches.reduce((acc, cur) => acc + cur.value, "");
    return JSON.parse(value);
  }

  private getCacheKey(index?: number): string[] {
    const key = ["client-db-cache"];
    if (index === undefined) {
      return key;
    }
    key.push("index-" + index);
    return key;
  }

  private createCacheBatches(toCache: unknown): { key: string[]; value: CacheValue }[] {
    const now = new Date().getTime();

    const value = JSON.stringify(toCache);
    const totalBatches = Math.floor(value.length / this.MAX_CACHE_BATCH_SIZE) + 1;

    const cacheBatches: { key: string[]; value: CacheValue }[] = [];

    for (let i = 0; i < totalBatches; i++) {
      cacheBatches.push({
        key: this.getCacheKey(i),
        value: {
          index: i,
          total: totalBatches,
          time: now,
          value: value.slice(i * this.MAX_CACHE_BATCH_SIZE, (i + 1) * this.MAX_CACHE_BATCH_SIZE),
        },
      });
    }
    return cacheBatches;
  }

  private async uploadCacheBatches(cacheBatches: { key: string[]; value: CacheValue }[]) {
    await Promise.all(cacheBatches.map(async ({ key, value }) => await kv.set(key, value)));
    return [];
  }
}
