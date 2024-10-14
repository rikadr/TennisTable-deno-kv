import { kv } from "../db.ts";
import { getPlayer } from "../player/player.ts";

export type Game = { winner: string; loser: string; time: number };
export type CreateGamePayload = { winner: string; loser: string };
export type DeleteGamePayload = { winner: string; loser: string; time: number };

export async function getAllGames(): Promise<Game[]> {
  const games: Game[] = [];

  const res = kv.list<Game>({ prefix: ["game", "main"] });
  for await (const game of res) {
    games.push(game.value);
  }

  games.sort((a, b) => a.time - b.time);
  return games;
}

export async function getGame(game: Game): Promise<Game | null> {
  const res = await kv.get<Game>(["game", "main", game.time]);
  if (!res.value) {
    return null;
  }
  return res.value;
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

  const res = await kv.atomic().set(keyMain, game).set(keyWinner, game).set(keyLoser, game).commit();

  if (res.ok) {
    return game;
  } else {
    throw new Error("Failed to create game");
  }
}

export async function importGame(gamedata: CreateGamePayload & { time: number }): Promise<Game | undefined> {
  if (!gamedata.winner || !gamedata.loser) {
    return;
  }
  const winner = await getPlayer(gamedata.winner);
  const loser = await getPlayer(gamedata.loser);
  if (!winner || !loser) {
    return;
  }

  const time = gamedata.time; // Use the time from the imported data
  const keyMain = ["game", "main", time]; // Source of truth
  // Additional keys to get games by player
  const keyWinner = ["game", "winner", winner.name, time];
  const keyLoser = ["game", "loser", loser.name, time];

  const game: Game = {
    winner: winner.name,
    loser: loser.name,
    time,
  };

  const res = await kv.atomic().set(keyMain, game).set(keyWinner, game).set(keyLoser, game).commit();

  if (res.ok) {
    return game;
  } else {
    return;
  }
}

export async function deleteAllGames(): Promise<{ deleted: number }> {
  let deleted = 0;

  const games = kv.list<Game>({ prefix: ["game"] });
  for await (const game of games) {
    const res = await kv.atomic().check({ key: game.key, versionstamp: game.versionstamp }).delete(game.key).commit();
    if (res.ok) {
      deleted++;
    }
  }
  return { deleted };
}

export async function deleteGame(game: Game): Promise<{
  deleted: boolean;
}> {
  const keyMain = ["game", "main", game.time];
  const keyWinner = ["game", "winner", game.winner, game.time];
  const keyLoser = ["game", "loser", game.loser, game.time];

  const res = await kv.atomic().delete(keyMain).delete(keyWinner).delete(keyLoser).commit();

  return { deleted: res.ok };
}
