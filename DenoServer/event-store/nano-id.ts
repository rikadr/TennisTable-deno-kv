import { customAlphabet } from "https://deno.land/x/nanoid/mod.ts";

export function newId(): string {
  return customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 10)();
}
