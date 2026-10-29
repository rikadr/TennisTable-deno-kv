import { getDb } from "../db.ts";

export type User = { username: string; password: string; role: string };

export async function createUser(client: string, username: string, password: string, role: string) {
  return getDb(client).createUser(username, password, role);
}

export async function getUser(client: string, username: string): Promise<User | null> {
  return getDb(client).getUser(username);
}

export async function remove(client: string, username: string) {
  await getDb(client).deleteUser(username);
}

export async function update(client: string, username: string, data: Partial<Omit<User, "username">>) {
  await getDb(client).updateUser(username, data);
}

export async function findAll(client: string): Promise<Omit<User, "password">[]> {
  return getDb(client).findAllUsers();
}
