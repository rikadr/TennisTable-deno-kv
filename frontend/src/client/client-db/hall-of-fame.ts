import { EventTypeEnum } from "./event-store/event-types";
import { TennisTable } from "./tennis-table";

export type SeasonDetail = { rank: number; points: number };
export type TournamentDetail = { name: string; placement: string; points: number };

export type HallOfFameScoreBreakdown = {
  seasonPerformance: { score: number; seasons: SeasonDetail[] };
  achievementsEarned: { score: number; count: number };
  socialDiversity: { score: number; uniqueOpponents: number };
  tournamentProgression: { score: number; tournaments: TournamentDetail[] };
  longevity: { score: number; activeDays: number };
  experience: { score: number; games: number };
  dataVolume: { score: number; gamesWithSets: number; gamesWithPoints: number };
  total: number;
};

export type HallOfFameEntry = {
  playerId: string;
  playerName: string;
  score: HallOfFameScoreBreakdown;
};

export type HallOfFameScoreHistoryEntry = {
  time: number;
  score: number;
};

export class HallOfFame {
  private parent: TennisTable;
  private cache: HallOfFameEntry[] | undefined;
  private playerCache = new Map<string, HallOfFameEntry>();
  private historyCache = new Map<string, HallOfFameScoreHistoryEntry[]>();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getHallOfFame(): HallOfFameEntry[] {
    if (this.cache !== undefined) return this.cache;
    const entries = this.#calculateAll();
    this.cache = entries;
    return entries;
  }

  getPlayerScore(playerId: string): HallOfFameEntry | undefined {
    return this.getHallOfFame().find((e) => e.playerId === playerId);
  }

  getScoreForAnyPlayer(playerId: string): HallOfFameEntry | undefined {
    const cached = this.playerCache.get(playerId);
    if (cached) return cached;
    const player = this.parent.eventStore.playersProjector.getPlayer(playerId);
    if (!player) return undefined;
    const score = this.#calculatePlayerScore(playerId);
    const entry = { playerId, playerName: player.name, score };
    this.playerCache.set(playerId, entry);
    return entry;
  }

  clearCache() {
    this.cache = undefined;
    this.playerCache.clear();
    this.historyCache.clear();
  }

  getScoreHistoryForPlayer(playerId: string): HallOfFameScoreHistoryEntry[] {
    const cached = this.historyCache.get(playerId);
    if (cached) return cached;

    const player = this.parent.eventStore.playersProjector.getPlayer(playerId);
    if (!player) return [];

    const playerCreatedEvent = this.parent.events.find(
      (e) => e.type === EventTypeEnum.PLAYER_CREATED && e.stream === playerId,
    );
    if (!playerCreatedEvent) return [];

    const startTime = playerCreatedEvent.time;
    let endTime: number;
    if (player.active) {
      endTime = Date.now();
    } else {
      const deactivationEvents = this.parent.events.filter(
        (e) => e.type === EventTypeEnum.PLAYER_DEACTIVATED && e.stream === playerId,
      );
      if (deactivationEvents.length === 0) return [];
      endTime = deactivationEvents[deactivationEvents.length - 1].time;
    }

    if (endTime <= startTime) return [];

    const SAMPLES = 50;
    const step = (endTime - startTime) / (SAMPLES - 1);
    const history: HallOfFameScoreHistoryEntry[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const time = i === SAMPLES - 1 ? endTime : Math.floor(startTime + step * i);
      const eventsAtTime = this.parent.events.filter((e) => e.time <= time);
      const snapshotTable = new TennisTable({ events: eventsAtTime });
      const entry = snapshotTable.hallOfFame.getScoreForAnyPlayer(playerId);
      history.push({ time, score: entry?.score.total ?? 0 });
    }

    this.historyCache.set(playerId, history);
    return history;
  }

  #calculateAll(): HallOfFameEntry[] {
    const inactivePlayers = this.parent.eventStore.playersProjector.inactivePlayers;

    const entries: HallOfFameEntry[] = inactivePlayers.map((player) => {
      const score = this.#calculatePlayerScore(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        score,
      };
    });

    return entries.sort((a, b) => b.score.total - a.score.total);
  }

  #calculatePlayerScore(playerId: string): HallOfFameScoreBreakdown {
    const seasonPerformance = this.#calcSeasonPerformance(playerId);
    const achievementsEarned = this.#calcAchievements(playerId);
    const socialDiversity = this.#calcSocialDiversity(playerId);
    const tournamentProgression = this.#calcTournamentProgression(playerId);
    const longevity = this.#calcLongevity(playerId);
    const experience = this.#calcExperience(playerId);
    const dataVolume = this.#calcDataVolume(playerId);

    const total =
      seasonPerformance.score + achievementsEarned.score + socialDiversity.score +
      tournamentProgression.score + longevity.score + experience.score + dataVolume.score;

    return {
      seasonPerformance,
      achievementsEarned,
      socialDiversity,
      tournamentProgression,
      longevity,
      experience,
      dataVolume,
      total: Math.round(total),
    };
  }

  #calcSeasonPerformance(playerId: string): HallOfFameScoreBreakdown["seasonPerformance"] {
    const seasons = this.parent.seasons.getSeasons();
    let score = 0;
    const seasonDetails: SeasonDetail[] = [];

    for (const season of seasons) {
      const leaderboard = season.getLeaderboard();
      const playerIndex = leaderboard.findIndex((p) => p.playerId === playerId);
      if (playerIndex === -1) continue;

      const rank = playerIndex + 1;
      let points: number;
      if (rank === 1) points = 100;
      else if (rank <= 3) points = 75;
      else if (rank <= 5) points = 50;
      else if (rank <= 10) points = 30;
      else points = 15;

      score += points;
      seasonDetails.push({ rank, points });
    }

    return { score, seasons: seasonDetails };
  }

  #calcAchievements(playerId: string): HallOfFameScoreBreakdown["achievementsEarned"] {
    this.parent.achievements.calculateAchievements();
    const achievements = this.parent.achievements.achievementMap.get(playerId);
    const count = achievements?.length ?? 0;
    return { score: count * 20, count };
  }

  #calcSocialDiversity(playerId: string): HallOfFameScoreBreakdown["socialDiversity"] {
    const opponents = new Set<string>();
    for (const game of this.parent.games) {
      if (game.winner === playerId) opponents.add(game.loser);
      else if (game.loser === playerId) opponents.add(game.winner);
    }
    return { score: opponents.size * 20, uniqueOpponents: opponents.size };
  }

  #calcTournamentProgression(playerId: string): HallOfFameScoreBreakdown["tournamentProgression"] {
    const tournaments = this.parent.tournaments.getTournaments();
    let score = 0;
    const tournamentDetails: TournamentDetail[] = [];

    for (const tournament of tournaments) {
      if (!tournament.tournamentConfig.playerOrder?.includes(playerId)) continue;

      if (tournament.winner === playerId) {
        score += 300;
        tournamentDetails.push({ name: tournament.name, placement: "Winner", points: 300 });
        continue;
      }

      if (tournament.bracket) {
        const { points, placement } = this.#getBracketResult(tournament.bracket.bracket, playerId);
        score += points;
        tournamentDetails.push({ name: tournament.name, placement, points });
      } else {
        score += 25;
        tournamentDetails.push({ name: tournament.name, placement: "Participated", points: 25 });
      }
    }

    return { score, tournaments: tournamentDetails };
  }

  #getBracketResult(bracket: Partial<{ player1: string; player2: string; winner?: string }>[][], playerId: string): { points: number; placement: string } {
    let bestLayer = -1;

    for (let layerIndex = 0; layerIndex < bracket.length; layerIndex++) {
      for (const match of bracket[layerIndex]) {
        if (match.player1 === playerId || match.player2 === playerId) {
          if (bestLayer === -1 || layerIndex < bestLayer) {
            bestLayer = layerIndex;
          }
        }
      }
    }

    if (bestLayer === -1) return { points: 25, placement: "Participated" };

    switch (bestLayer) {
      case 0: return { points: 200, placement: "Final" };
      case 1: return { points: 100, placement: "Semi Finals" };
      case 2: return { points: 75, placement: "Quarter Finals" };
      default: return { points: 50, placement: "Bracket" };
    }
  }

  #calcLongevity(playerId: string): HallOfFameScoreBreakdown["longevity"] {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * ONE_DAY;
    const gameTimes = this.parent.games
      .filter((g) => g.winner === playerId || g.loser === playerId)
      .map((g) => g.playedAt)
      .sort((a, b) => a - b);

    if (gameTimes.length === 0) return { score: 0, activeDays: 0 };
    if (gameTimes.length === 1) return { score: 1, activeDays: 1 };

    let totalMs = ONE_DAY; // Count the first game's day
    for (let i = 1; i < gameTimes.length; i++) {
      const gap = gameTimes[i] - gameTimes[i - 1];
      if (gap <= THIRTY_DAYS) {
        totalMs += gap;
      } else {
        totalMs += ONE_DAY; // Count the next game's day as a new starting day
      }
    }

    const activeDays = Math.floor(totalMs / ONE_DAY);
    return { score: activeDays, activeDays };
  }

  #calcExperience(playerId: string): HallOfFameScoreBreakdown["experience"] {
    const games = this.parent.games.filter(
      (g) => g.winner === playerId || g.loser === playerId,
    ).length;
    return { score: games * 3, games };
  }

  #calcDataVolume(playerId: string): HallOfFameScoreBreakdown["dataVolume"] {
    let gamesWithSets = 0;
    let gamesWithPoints = 0;

    for (const game of this.parent.games) {
      if (game.winner !== playerId && game.loser !== playerId) continue;
      if (!game.score) continue;

      if (game.score.setsWon) {
        gamesWithSets++;
      }

      if (game.score.setPoints && game.score.setPoints.length > 0) {
        gamesWithPoints++;
      }
    }

    return { score: gamesWithSets + gamesWithPoints, gamesWithSets, gamesWithPoints };
  }
}
