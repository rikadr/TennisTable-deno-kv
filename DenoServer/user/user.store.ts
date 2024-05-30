import { kv } from "../db.ts";

export type User = { username: string; password: string };

export async function createUser(username: string, password: string) {
  const user = { username, password };
  await kv.set(["user", username], user);
  return user;
}

export async function getUser(username: string): Promise<User | null> {
  const user = await kv.get<User>(["user", username]);
  return user.value;
}
