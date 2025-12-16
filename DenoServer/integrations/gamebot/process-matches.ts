import { kv } from "../../db.ts";
import { storeEvent } from "../../event-store/event-store.ts";
import { EventType, EventTypeEnum } from "../../event-store/event-types.ts";
import { newId } from "../../event-store/nano-id.ts";
import { webSocketClientManager } from "../../server.ts";

export interface MatchesApiResponse {
  _embedded: {
    matches: Array<{
      id: string;
      tied?: boolean;
      resigned?: boolean;
      scores?: [number, number][]; // [loser, winner][]
      created_at: string; // ISO timestamp
      _links: {
        winners: { href: string[] };
        losers: { href: string[] };
      };
    }>;
  };
  total_count?: number;
}

const LAST_SYNCED_MATCH_TIMESTAMP_KV_KEY = "gamebot:last_synced_match_timestamp";
const FIRST_SYNC_FROM = 1765500000000; // Fri Dec 12 2025 01:40:00 GMT+0100

export async function processMatchesResponse(response: MatchesApiResponse) {
  const matches = response._embedded?.matches;
  if (Array.isArray(matches) === false) {
    return;
  }

  let syncFrom = FIRST_SYNC_FROM;

  const lastSynced = await kv.get<number>([LAST_SYNCED_MATCH_TIMESTAMP_KV_KEY]);
  if (lastSynced.value !== null) {
    syncFrom = Math.max(FIRST_SYNC_FROM, lastSynced.value);
  }

  const matchesToSync = matches
    .filter((match) => new Date(match.created_at).getTime() > syncFrom)
    .filter((match) => !match.resigned && !match.tied)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (matchesToSync.length === 0) {
    return;
  }
  console.log(`Syncing ${matchesToSync.length} match(es)...`);

  const eventsToWrite: EventType[] = [];

  for (const match of matchesToSync) {
    const winner = userIdToPlayerId(userIdFromUrl(match._links.winners.href[0]));
    const loser = userIdToPlayerId(userIdFromUrl(match._links.losers.href[0]));
    const timestamp = new Date(match.created_at).getTime();
    const stream = newId();

    eventsToWrite.push({
      type: EventTypeEnum.GAME_CREATED,
      stream,
      time: timestamp,
      data: {
        playedAt: timestamp,
        winner,
        loser,
      },
    });

    if (match.scores && match.scores.length > 0) {
      const winnerSets = match.scores.filter(([gameLoserScore, gameWinnerScore]) => gameWinnerScore > gameLoserScore);
      const loserSets = match.scores.filter(([gameLoserScore, gameWinnerScore]) => gameWinnerScore < gameLoserScore);
      eventsToWrite.push({
        type: EventTypeEnum.GAME_SCORE,
        stream,
        time: timestamp + 1,
        data: {
          setsWon: { gameWinner: winnerSets.length, gameLoser: loserSets.length },
          setPoints: match.scores
            .filter(([gameLoserScore, gameWinnerScore]) => gameWinnerScore !== gameLoserScore)
            .map(([gameLoser, gameWinner]) => ({ gameWinner, gameLoser })),
        },
      });
    }
  }

  for (const event of eventsToWrite) {
    await storeEvent(event);
  }
  const lastEventSynced = Math.max(...eventsToWrite.map((e) => e.time));
  const result = await kv.atomic().set([LAST_SYNCED_MATCH_TIMESTAMP_KV_KEY], lastEventSynced).commit();
  if (!result.ok) {
    console.error(`Failed to store lastEventSynced ${lastEventSynced}`);
  }

  console.log(`Compleded syncing ${matchesToSync.length} matches, resulting in ${eventsToWrite.length} events.`);

  // webSocketClientManager.broadcastRefetch(); // Maybe too hars to do full refetch?
  webSocketClientManager.broadcastLatestEvent();
}

function userIdFromUrl(url?: string): string {
  if (!url) {
    throw new Error("Missing url in fn userIdFromUrl");
  }
  const split = url.split("/");
  return split[split.length - 1];
}

function userIdToPlayerId(userId: string): string {
  const maped = gameBotToPlayerMap[userId];
  if (!maped) {
    throw new Error(`Unable to map ${userId} to player Id`);
  }
  return maped;
}

const gameBotToPlayerMap: Record<string, string> = {
  "689484134a3a2b962399bc04": "tGHeOBvsUo", // Haakon
  "689484134a3a2b962399bc03": "bBdYZ3T8V5", // arvind
  "68a5d5ed4a3a2b962399bc70": "tfCWz2M7dH", // kristoffer
  "689f1cfa4a3a2b962399bc49": "0y0kOkoMRL", // rebekka
  "68aee2f84a3a2b962399bc9b": "4JAUZsUamY", // mikal
  "6895d58f4a3a2b962399bc0a": "7LRdCxp7pP", // helen
  "689f1d8d4a3a2b962399bc4d": "lzYjxpPaCO", // ibrekka - Brekkå
  "68b5a3194a3a2b962399bca3": "xstF71wz9O", // birk
  "68b6c2174a3a2b962399bca7": "N9umd5ogYq", // philip
  "68b1a5b14a3a2b962399bc9f": "Cer2wbt0b2", // taras
  "68e4edeb5bc98af648399ae7": "igblofRfrK", // hamza
  "68e3c5055bc98af648399adf": "3613tjHh6h", // tidemann
  "689dcc4e4a3a2b962399bc3f": "4f9ch82O4G", // andreas
  "68a72fb94a3a2b962399bc7b": "7sF8MAk3Ov", // ivar
  "6895d58f4a3a2b962399bc0b": "YTDLgL1q3z", // karoline
  "68b9931c4a3a2b962399bcb4": "jqYmcqdmqL", // jorgen
  // "68c82dc84a3a2b962399bcee": "___", // jnyborg ??? dont know who this is
  // "68c805544a3a2b962399bce6": "___", // anyone *
};
