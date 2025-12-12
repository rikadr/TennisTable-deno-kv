import {
  EventType,
  EventTypeEnum,
} from "../client/client-db/event-store/event-types";
import { newId } from "../common/nani-id";

interface DeepInsightMatch {
  date: string;
  winner: string;
  loser: string;
  score: string | null;
}

export interface DeepInsightData {
  matches: DeepInsightMatch[];
}

const MONTHS: { [key: string]: number } = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseDateStr(dateStr: string): number {
  // Reference date: 2025-12-12
  const now = new Date("2025-12-12T13:20:42+01:00");
  const currentYear = now.getFullYear();

  // Handle "Yesterday"
  if (dateStr.toLowerCase().startsWith("yesterday")) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    // Extract time: "Yesterday at 3:21 PM"
    const timePart = dateStr.split("at")[1].trim();
    return parseTimeOnDate(yesterday, timePart);
  }

  // Format: "Aug 7th at 12:49 PM"
  // Remove suffixes: st, nd, rd, th (preceded by a digit)
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1").replace("at ", "");
  // cleaned: "Aug 7 12:49 PM"
  
  const parts = cleaned.split(" ");
  const monthStr = parts[0];
  const day = parseInt(parts[1], 10);
  const timeStr = parts.slice(2).join(" "); // "12:49 PM"

  const month = MONTHS[monthStr];
  if (month === undefined) {
      throw new Error(`Unknown month in date: ${dateStr}`);
  }

  const date = new Date(currentYear, month, day);
  return parseTimeOnDate(date, timeStr);
}

function parseTimeOnDate(date: Date, timeStr: string): number {
    // timeStr: "12:49 PM"
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "PM" && hours < 12) {
        hours += 12;
    }
    if (modifier === "AM" && hours === 12) {
        hours = 0;
    }

    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result.getTime();
}

export function convertDeepInsightData(data: DeepInsightData): EventType[] {
  const events: EventType[] = [];

  // 1. Parse all matches and sort them by time
  const parsedMatches = data.matches.map((m) => {
    return {
      ...m,
      timestamp: parseDateStr(m.date),
    };
  });

  // Sort matches by timestamp
  parsedMatches.sort((a, b) => a.timestamp - b.timestamp);

  // 2. Identify players and their first game time
  const firstGameTime: { [player: string]: number } = {};
  
  for (const match of parsedMatches) {
      const players = [match.winner, match.loser];
      for (const p of players) {
          if (firstGameTime[p] === undefined) {
              firstGameTime[p] = match.timestamp;
          } else {
              // Ensure we keep the earliest time (though we are sorted, so the first encounter is the earliest)
              firstGameTime[p] = Math.min(firstGameTime[p], match.timestamp);
          }
      }
  }

  // 3. Create PLAYER_CREATED events
  const playerNameToId = new Map<string, string>();
  const playerCreationTimes: { player: string; time: number }[] = [];
  
  for (const player of Object.keys(firstGameTime)) {
      playerCreationTimes.push({
          player,
          time: firstGameTime[player] - 1000
      });
  }

  // Sort by time to handle collisions deterministically
  playerCreationTimes.sort((a, b) => a.time - b.time);

  // Track all used timestamps to ensure global uniqueness
  const usedTimestamps = new Set<number>();

  // Resolve collisions for players
  for (let i = 0; i < playerCreationTimes.length; i++) {
      let t = playerCreationTimes[i].time;
      if (i > 0 && t <= playerCreationTimes[i-1].time) {
          t = playerCreationTimes[i-1].time + 1;
      }
      playerCreationTimes[i].time = t;
      usedTimestamps.add(t);
  }

  const PREFERRED_IDS = [
    "bBdYZ3T8V5",
    "YgxfDTfIYW",
    "7LRdCxp7pP",
    "YTDLgL1q3z",
    "tGHeOBvsUo",
    "4f9ch82O4G",
    "0y0kOkoMRL",
    "7sF8MAk3Ov",
    "4JAUZsUamY",
    "Cer2wbt0b2",
    "xstF71wz9O",
    "N9umd5ogYq",
    "jqYmcqdmqL",
    "tfCWz2M7dH",
    "lzYjxpPaCO",
    "3613tjHh6h",
    "igblofRfrK",
    "2yJpIRNAZR",
    "ZlrXhSoQ3J",
  ];

  for (let i = 0; i < playerCreationTimes.length; i++) {
      const pc = playerCreationTimes[i];
      // Use preferred ID if available, otherwise generate new
      const playerId = i < PREFERRED_IDS.length ? PREFERRED_IDS[i] : newId();
      
      playerNameToId.set(pc.player, playerId);

      events.push({
          type: EventTypeEnum.PLAYER_CREATED,
          time: pc.time,
          stream: playerId, 
          data: { name: pc.player }
      });
  }

  // 4. Create GAME events
  for (const match of parsedMatches) {
      // Find a unique timestamp for GAME_CREATED
      let gameTime = match.timestamp;
      
      // If we have collisions with EXISTING events (players or previous games)
      while (usedTimestamps.has(gameTime)) {
          gameTime++;
      }
      usedTimestamps.add(gameTime);

      const gameStreamId = newId();

      const winnerId = playerNameToId.get(match.winner);
      const loserId = playerNameToId.get(match.loser);

      if (!winnerId || !loserId) {
          throw new Error(`Could not find player ID for ${match.winner} or ${match.loser}`);
      }

      events.push({
          type: EventTypeEnum.GAME_CREATED,
          time: gameTime,
          stream: gameStreamId,
          data: {
              playedAt: match.timestamp,
              winner: winnerId,
              loser: loserId
          }
      });

      if (match.score) {
          // Parse score
          const setStrings = match.score.split(" ");
          const setPoints: { gameWinner: number; gameLoser: number }[] = [];
          
          let p1Sets = 0;
          let p2Sets = 0;

          for (const s of setStrings) {
              const [w, l] = s.split(":").map(Number);
              setPoints.push({ gameWinner: w, gameLoser: l });
              if (w > l) p1Sets++;
              else p2Sets++;
          }

          // Unique timestamp for score
          let scoreTime = gameTime + 1;
          while (usedTimestamps.has(scoreTime)) {
            scoreTime++;
          }
          usedTimestamps.add(scoreTime);

          events.push({
              type: EventTypeEnum.GAME_SCORE,
              time: scoreTime,
              stream: gameStreamId,
              data: {
                  setsWon: { gameWinner: p1Sets, gameLoser: p2Sets },
                  setPoints: setPoints
              }
          });
      }
  }

  // Final sort by timestamp
  events.sort((a, b) => a.time - b.time);

  return events;
}
