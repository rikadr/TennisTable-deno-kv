import { kv } from "../db.ts";

export type Player = { name: string };
export type CreatePlayerPayload = { name: string };

export async function getPlayer(name: string): Promise<Player | null> {
  if (!name) {
    throw new Error("name is required");
  }
  const res = await kv.get(["player", name]);

  if (res.value) {
    return res.value as Player;
  }
  return null;
}

export async function getAllPlayers(): Promise<Player[]> {
  const players: Player[] = [];
  const res = kv.list<Player>({ prefix: ["player"] });

  for await (const player of res) {
    players.push(player.value);
  }
  return players;
}

export async function createPlayer(payload: CreatePlayerPayload): Promise<Player> {
  if (!payload.name) {
    throw new Error("name is required");
  }
  const key = ["player", payload.name];
  const value: Player = { name: payload.name };

  const res = await kv.atomic().check({ key, versionstamp: null }).set(key, value).commit();

  if (res.ok) {
    return value;
  } else {
    throw new Error("Failed to create player");
  }
}

export async function deletePlayer(name: string) {
  if (!name) {
    throw new Error("name is required");
  }
  await kv.delete(["player", name]);
}

export async function uploadProfilePicture(name: string, base64: string) {
  if (!name) {
    throw new Error("name is required");
  }

  if (!base64) {
    throw new Error("base64 is required");
  }

  const res = await kv.set(["profile-picture", name], base64);

  if (res.ok) {
    return;
  } else {
    throw new Error("Failed to upload profile picture");
  }
}

export async function getProfilePicture(name: string): Promise<string | null> {
  if (!name) {
    throw new Error("name is required");
  }

  const res = await kv.get(["profile-picture", name]);

  if (res.value) {
    return res.value as string;
  }
  return null;
}
