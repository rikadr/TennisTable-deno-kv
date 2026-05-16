import { Elo } from "./elo";
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
  peakElo: { score: number; peakElo: number };
  podiumTime: { score: number; rank1Days: number; rank2Days: number; rank3Days: number };
  total: number;
};

export type HallOfFameEntry = {
  playerId: string;
  playerName: string;
  score: HallOfFameScoreBreakdown;
};

export type HallOfFameFactorKey =
  | "seasonPerformance"
  | "achievementsEarned"
  | "socialDiversity"
  | "tournamentProgression"
  | "longevity"
  | "experience"
  | "dataVolume"
  | "peakElo"
  | "podiumTime";

export type HallOfFameSectionStats = Record<HallOfFameFactorKey, { max: number; rank: number }>;

const FACTOR_KEYS: HallOfFameFactorKey[] = [
  "seasonPerformance",
  "achievementsEarned",
  "socialDiversity",
  "tournamentProgression",
  "longevity",
  "experience",
  "dataVolume",
  "peakElo",
  "podiumTime",
];

export class HallOfFame {
  private parent: TennisTable;
  private cache: HallOfFameEntry[] | undefined;
  private playerCache = new Map<string, HallOfFameEntry>();
  private sectionMaxes: Record<HallOfFameFactorKey, number> | undefined;
  private sectionRanks: Record<HallOfFameFactorKey, Map<string, number>> | undefined;
  private peakEloCache: Map<string, number> | undefined;
  private podiumMsCache: Map<string, { rank1: number; rank2: number; rank3: number }> | undefined;

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

  getSectionStats(playerId: string): HallOfFameSectionStats | undefined {
    this.#ensureCrossPlayerStats();
    if (!this.sectionMaxes || !this.sectionRanks) return undefined;
    const stats = {} as HallOfFameSectionStats;
    for (const key of FACTOR_KEYS) {
      stats[key] = {
        max: this.sectionMaxes[key],
        rank: this.sectionRanks[key].get(playerId) ?? 0,
      };
    }
    return stats;
  }

  clearCache() {
    this.cache = undefined;
    this.playerCache.clear();
    this.sectionMaxes = undefined;
    this.sectionRanks = undefined;
    this.peakEloCache = undefined;
    this.podiumMsCache = undefined;
  }

  #ensureCrossPlayerStats() {
    if (this.sectionMaxes && this.sectionRanks) return;

    const allPlayers = [
      ...this.parent.eventStore.playersProjector.activePlayers,
      ...this.parent.eventStore.playersProjector.inactivePlayers,
    ];

    const scoresByFactor: Record<HallOfFameFactorKey, { playerId: string; score: number }[]> = {
      seasonPerformance: [],
      achievementsEarned: [],
      socialDiversity: [],
      tournamentProgression: [],
      longevity: [],
      experience: [],
      dataVolume: [],
      peakElo: [],
      podiumTime: [],
    };

    for (const player of allPlayers) {
      const breakdown = this.#calculatePlayerScore(player.id);
      for (const key of FACTOR_KEYS) {
        scoresByFactor[key].push({ playerId: player.id, score: breakdown[key].score });
      }
    }

    const maxes = {} as Record<HallOfFameFactorKey, number>;
    const ranks = {} as Record<HallOfFameFactorKey, Map<string, number>>;

    for (const key of FACTOR_KEYS) {
      const sorted = scoresByFactor[key].sort((a, b) => b.score - a.score);
      maxes[key] = sorted[0]?.score ?? 0;

      const rankMap = new Map<string, number>();
      let currentRank = 0;
      let lastScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].score !== lastScore) {
          currentRank = i + 1;
          lastScore = sorted[i].score;
        }
        rankMap.set(sorted[i].playerId, currentRank);
      }
      ranks[key] = rankMap;
    }

    this.sectionMaxes = maxes;
    this.sectionRanks = ranks;
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
    const peakElo = this.#calcPeakElo(playerId);
    const podiumTime = this.#calcPodiumTime(playerId);

    const total =
      seasonPerformance.score + achievementsEarned.score + socialDiversity.score +
      tournamentProgression.score + longevity.score + experience.score + dataVolume.score +
      peakElo.score + podiumTime.score;

    return {
      seasonPerformance,
      achievementsEarned,
      socialDiversity,
      tournamentProgression,
      longevity,
      experience,
      dataVolume,
      peakElo,
      podiumTime,
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

  #calcPeakElo(playerId: string): HallOfFameScoreBreakdown["peakElo"] {
    const summary = this.parent.leaderboard.getPlayerSummary(playerId);
    if (!summary.isRanked) {
      return { score: 0, peakElo: 0 };
    }
    const peakElo = this.#getPeakElos().get(playerId) ?? Elo.INITIAL_ELO;
    const score = Math.max(0, peakElo - Elo.INITIAL_ELO);
    return { score, peakElo };
  }

  #getPeakElos(): Map<string, number> {
    if (this.peakEloCache) return this.peakEloCache;
    const peaks = new Map<string, number>();
    const gameLimitForRanked = this.parent.client.gameLimitForRanked;
    const trackPeak = (player: { id: string; elo: number; totalGames: number } | undefined) => {
      if (!player || player.totalGames < gameLimitForRanked) return;
      const current = peaks.get(player.id);
      if (current === undefined || player.elo > current) peaks.set(player.id, player.elo);
    };
    Elo.eloCalculator(this.parent.games, this.parent.allPlayers, (map, game) => {
      trackPeak(map.get(game.winner));
      trackPeak(map.get(game.loser));
    });
    this.peakEloCache = peaks;
    return peaks;
  }

  #calcPodiumTime(playerId: string): HallOfFameScoreBreakdown["podiumTime"] {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ms = this.#getPodiumMsByPlayer().get(playerId);
    const rank1Days = Math.floor((ms?.rank1 ?? 0) / ONE_DAY);
    const rank2Days = Math.floor((ms?.rank2 ?? 0) / ONE_DAY);
    const rank3Days = Math.floor((ms?.rank3 ?? 0) / ONE_DAY);
    const score = rank1Days + rank2Days * 0.5 + rank3Days * 0.5;
    return { score, rank1Days, rank2Days, rank3Days };
  }

  #getPodiumMsByPlayer(): Map<string, { rank1: number; rank2: number; rank3: number }> {
    if (this.podiumMsCache) return this.podiumMsCache;
    const result = new Map<string, { rank1: number; rank2: number; rank3: number }>();
    const gameLimitForRanked = this.parent.client.gameLimitForRanked;

    type Timeline = { kind: "game"; time: number; winner: string; loser: string }
      | { kind: "activity"; time: number; playerId: string; active: boolean };

    const timeline: Timeline[] = [];
    for (const event of this.parent.events) {
      switch (event.type) {
        case EventTypeEnum.PLAYER_CREATED:
          timeline.push({ kind: "activity", time: event.time, playerId: event.stream, active: true });
          break;
        case EventTypeEnum.PLAYER_DEACTIVATED:
          timeline.push({ kind: "activity", time: event.time, playerId: event.stream, active: false });
          break;
        case EventTypeEnum.PLAYER_REACTIVATED:
          timeline.push({ kind: "activity", time: event.time, playerId: event.stream, active: true });
          break;
      }
    }
    for (const game of this.parent.games) {
      timeline.push({ kind: "game", time: game.playedAt, winner: game.winner, loser: game.loser });
    }
    timeline.sort((a, b) => a.time - b.time);

    type State = { elo: number; totalGames: number; active: boolean };
    const playerState = new Map<string, State>();
    let currentTop3: string[] = [];
    let lastTime: number | undefined;

    const recomputeTop3 = (): string[] =>
      Array.from(playerState.entries())
        .filter(([, s]) => s.active && s.totalGames >= gameLimitForRanked)
        .sort((a, b) => b[1].elo - a[1].elo)
        .slice(0, 3)
        .map(([id]) => id);

    const creditAt = (playerId: string, rank: 1 | 2 | 3, elapsed: number) => {
      const existing = result.get(playerId) ?? { rank1: 0, rank2: 0, rank3: 0 };
      if (rank === 1) existing.rank1 += elapsed;
      else if (rank === 2) existing.rank2 += elapsed;
      else existing.rank3 += elapsed;
      result.set(playerId, existing);
    };

    for (const entry of timeline) {
      if (lastTime !== undefined && currentTop3.length > 0) {
        const elapsed = entry.time - lastTime;
        if (elapsed > 0) {
          for (let i = 0; i < currentTop3.length; i++) {
            const rank = (i + 1) as 1 | 2 | 3;
            creditAt(currentTop3[i], rank, elapsed);
          }
        }
      }

      if (entry.kind === "game") {
        const winner = playerState.get(entry.winner);
        const loser = playerState.get(entry.loser);
        if (winner && loser) {
          winner.totalGames++;
          loser.totalGames++;
          const { winnersNewElo, losersNewElo } = Elo.calculateELO(
            winner.elo,
            loser.elo,
            winner.totalGames,
            loser.totalGames,
          );
          winner.elo = winnersNewElo;
          loser.elo = losersNewElo;
        }
      } else {
        const existing = playerState.get(entry.playerId);
        if (existing) {
          existing.active = entry.active;
        } else {
          playerState.set(entry.playerId, { elo: Elo.INITIAL_ELO, totalGames: 0, active: entry.active });
        }
      }

      currentTop3 = recomputeTop3();
      lastTime = entry.time;
    }

    this.podiumMsCache = result;
    return result;
  }
}
