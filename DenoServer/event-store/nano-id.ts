import { customAlphabet } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";

export function newId(): string {
  return customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 10)();
}
