import { kv } from "../db.ts";

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

export async function importGame(gamedata: CreateGamePayload & { time: number }): Promise<Game | undefined> {
  const time = gamedata.time; // Use the time from the imported data
  const keyMain = ["game", "main", time]; // Source of truth
  // Additional keys to get games by player
  const keyWinner = ["game", "winner", gamedata.winner, time];
  const keyLoser = ["game", "loser", gamedata.loser, time];

  const game: Game = {
    winner: gamedata.winner,
    loser: gamedata.loser,
    time,
  };

  const res = await kv.atomic().set(keyMain, game).set(keyWinner, game).set(keyLoser, game).commit();

  if (res.ok) {
    return game;
  } else {
    return;
  }
}
