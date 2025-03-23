import { customAlphabet } from "nanoid";

export function newId(): string {
  return customAlphabet("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 10)();
}
