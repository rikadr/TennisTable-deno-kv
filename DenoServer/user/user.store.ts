import { db } from "../db.ts";

export type User = { username: string; password: string; role: string };

export async function createUser(username: string, password: string, role: string) {
  return db.createUser(username, password, role);
}

export async function getUser(username: string): Promise<User | null> {
  return db.getUser(username);
}

export async function remove(username: string) {
  await db.deleteUser(username);
}

export async function update(username: string, data: Partial<Omit<User, "username">>) {
  await db.updateUser(username, data);
}

export async function findAll(): Promise<Omit<User, "password">[]> {
  return db.findAllUsers();
}
