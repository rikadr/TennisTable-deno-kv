import { kv } from "../db.ts";
import { getPlayer } from "../player/player.ts";

export type Game = { winner: string; loser: string; time: number };
export type CreateGamePayload = { winner: string; loser: string };

export async function getAllGames(): Promise<Game[]> {
  const games: Game[] = [];

  const res = kv.list<Game>({ prefix: ["game", "main"] });
  for await (const game of res) {
    games.push(game.value);
  }

  games.sort((a, b) => a.time - b.time);
  return games;
}

export async function getGamesByPlayer(name: string): Promise<Game[]> {
  if (!name) {
    throw new Error("name is required");
  }
  const player = await getPlayer(name);
  if (!player) {
    throw new Error("Player not found");
  }

  const games: Game[] = [];

  // Games where player is winner
  const resWinner = kv.list<Game>({ prefix: ["game", "winner", player.name] });
  for await (const game of resWinner) {
    games.push(game.value);
  }
  // Games where player is loser
  const resLoser = kv.list<Game>({ prefix: ["game", "loser", player.name] });
  for await (const game of resLoser) {
    games.push(game.value);
  }

  games.sort((a, b) => a.time - b.time);
  return games;
}

export async function createGame(payload: CreateGamePayload): Promise<Game> {
  if (!payload.winner || !payload.loser) {
    throw new Error("winner and loser is required");
  }
  const winner = await getPlayer(payload.winner);
  const loser = await getPlayer(payload.loser);
  if (!winner || !loser) {
    throw new Error("Winner and loser must be valid players");
  }

  const time = new Date().getTime();

  const keyMain = ["game", "main", time]; // Source of truth
  // Additional keys to get games by player
  const keyWinner = ["game", "winner", winner.name, time];
  const keyLoser = ["game", "loser", loser.name, time];

  const game: Game = {
    winner: winner.name,
    loser: loser.name,
    time,
  };

  const res = await kv
    .atomic()
    .set(keyMain, game)
    .set(keyWinner, game)
    .set(keyLoser, game)
    .commit();

  if (res.ok) {
    return game;
  } else {
    throw new Error("Failed to create game");
  }
}

export async function deleteAllGames(): Promise<{ deleted: number }> {
  let deleted = 0;

  const games = kv.list<Game>({ prefix: ["game"] });
  for await (const game of games) {
    const res = await kv
      .atomic()
      .check({ key: game.key, versionstamp: game.versionstamp })
      .delete(game.key)
      .commit();
    if (res.ok) {
      deleted++;
    }
  }
  return { deleted };
}
