/// <reference lib="deno.unstable" />
export const kv = await Deno.openKv(); // add ":memory:" for local memory storage, for fresh one-off db or testing
