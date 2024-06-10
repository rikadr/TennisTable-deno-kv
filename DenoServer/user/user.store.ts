import { kv } from "../db.ts";

export type User = { username: string; password: string; role: string };

export async function createUser(username: string, password: string, role: string) {
  const user = { username, password, role };
  await kv.set(["user", username], user);
  return user;
}

export async function getUser(username: string): Promise<User | null> {
  const user = await kv.get<User>(["user", username]);
  return user.value;
}

export async function remove(username: string) {
  await kv.delete(["user", username]);
}

export async function update(username: string, data: Partial<Omit<User, "username">>) {
  const user = await kv.get<User>(["user", username]);
  if (!user) {
    throw new Error("User not found");
  }

  await kv.set(["user", username], { ...user.value, ...data });
}

export async function findAll(): Promise<Omit<User, "password">[]> {
  const result = kv.list<User>({ prefix: ["user"] });

  const users: { username: string; role: string }[] = [];

  for await (const user of result) {
    users.push({
      username: user.value.username,
      role: user.value.role,
    });
  }

  return users;
}
