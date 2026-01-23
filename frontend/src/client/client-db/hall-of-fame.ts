import { TennisTable } from "./tennis-table";
import { Elo } from "./elo";

export type HallOfFameEntry = {
  id: string;
  name: string;
  titles: string[];
  honors: {
    peakElo: number;
    totalGames: number;
    wins: number;
    loss: number;
    winRate: number;
    daysActive: number;
    longestStreak: number;
    nemesis?: { id: string; losses: number };
    favoriteVictim?: { id: string; wins: number };
    bestSeason?: { id: string; name: string; rank: number };
    averageSeasonRank?: number;
    tournamentStats?: {
      won: number;
      finals: number;
      participated: number;
    };
    primeWindow?: { start: number; end: number; durationDays: number };
    activityHeatmap?: { [date: string]: number };
    playStyle?: string[];
    cleanSweeps?: number;
    legacyScore: number;
    milestones: { type: string; label: string; date: number; icon: string }[];
    rawStats?: {
      gamesPlayed: number;
      setsWon: number;
      setsLost: number;
      pointsScored: number;
      pointsConceded: number;
    };
    legacyBreakdown?: {
      eloScore: number;
      winRateScore: number;
      tournamentScore: number;
      finalsScore: number;
      longevityScore: number;
      experienceScore: number;
    };
  };
};

export class HallOfFame {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getHallOfFame(): HallOfFameEntry[] {
    const deactivatedPlayers = this.parent.deactivatedPlayers;
    if (deactivatedPlayers.length === 0) {
      return [];
    }

    const leaderboardMap = this.parent.leaderboard.getCachedLeaderboardMap();
    // Force recalculation to ensure we catch all achievements including those for deactivated players
    // if they were missed in a previous incremental update.
    this.parent.achievements.forceRecalculate(); 
    const seasons = this.parent.seasons.getSeasons();
    const tournaments = this.parent.tournaments.getTournaments();

    const pioneers = new Set(
      this.parent.allPlayers
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 10)
        .map((p) => p.id)
    );

    return deactivatedPlayers.map((player) => {
      const summary = this.parent.leaderboard.getPlayerSummary(player.id);
      
      // Default stats
      const wins = summary?.wins ?? 0;
      const loss = summary?.loss ?? 0;
      const totalGames = wins + loss;
      
      // Milestones
      const milestones: { type: string; label: string; date: number; icon: string }[] = [
          { type: 'joined', label: 'Inducted into League', date: player.createdAt, icon: '🌱' }
      ];

      // Calculate Peak Elo & Streak
      let peakElo = Elo.INITIAL_ELO;
      let peakEloDate = player.createdAt;
      let currentStreak = 0;
      let longestStreak = 0;
      let cleanSweeps = 0;
      const activityHeatmap: { [date: string]: number } = {};
      
      // Raw Stats
      let setsWon = 0;
      let setsLost = 0;
      let pointsScored = 0;
      let pointsConceded = 0;
      
      // Play Style Analysis vars
      let closeWins = 0;
      let dominantWins = 0; 
      
      const sortedGames = [...(summary?.games ?? [])].sort((a, b) => a.time - b.time);

      if (sortedGames.length > 0) {
        milestones.push({ type: 'first-game', label: 'First Professional Match', date: sortedGames[0].time, icon: '🏓' });
        
        for (const game of sortedGames) {
          if (game.eloAfterGame > peakElo) {
            peakElo = game.eloAfterGame;
            peakEloDate = game.time;
          }
          
          // Calculate Raw Stats from Score
          if (game.score?.setsWon) {
             const isWinner = game.result === "win";
             const mySets = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
             const oppSets = isWinner ? game.score.setsWon.gameLoser : game.score.setsWon.gameWinner;
             setsWon += mySets;
             setsLost += oppSets;
          }
          
          if (game.score?.setPoints) {
             const isWinner = game.result === "win";
             for (const set of game.score.setPoints) {
                const myPoints = isWinner ? set.gameWinner : set.gameLoser;
                const oppPoints = isWinner ? set.gameLoser : set.gameWinner;
                pointsScored += myPoints;
                pointsConceded += oppPoints;
             }
          }

          if (game.result === "win") {
            currentStreak++;
            if (game.score?.setsWon && game.score.setsWon.gameWinner === 3 && game.score.setsWon.gameLoser === 0) {
                cleanSweeps++;
            }
            if (game.pointsDiff <= 5) closeWins++;
            if (game.pointsDiff >= 15) dominantWins++;
          } else {
            currentStreak = 0;
          }
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }

          const dateKey = new Date(game.time).toISOString().split('T')[0];
          activityHeatmap[dateKey] = (activityHeatmap[dateKey] || 0) + 1;
        }
        
        milestones.push({ type: 'peak-elo', label: 'Reached Career Peak Elo', date: peakEloDate, icon: '⚡' });
        milestones.push({ type: 'last-game', label: 'Final League Match', date: sortedGames[sortedGames.length - 1].time, icon: '🏁' });
      }

      // Determine Play Style Tags
      const playStyle: string[] = [];
      if (cleanSweeps >= 5 && cleanSweeps / wins > 0.3) playStyle.push("🧹 Sweeper");
      if (closeWins >= 5 && closeWins / wins > 0.2) playStyle.push("🤏 Clincher");
      if (dominantWins >= 5 && dominantWins / wins > 0.2) playStyle.push("💪 Dominator");
      if (playStyle.length === 0 && totalGames > 50) playStyle.push("🛡️ Grinder");

      // Calculate Prime Window (Longest period >= 95% of Peak Elo)
      let primeWindow: { start: number; end: number; durationDays: number } | undefined;
      if (peakElo > Elo.INITIAL_ELO && sortedGames.length > 5) {
        const threshold = peakElo * 0.95;
        let currentPeriodStart: number | undefined;
        let maxDuration = 0;

        for (let i = 0; i < sortedGames.length; i++) {
          const game = sortedGames[i];
          if (game.eloAfterGame >= threshold) {
            if (currentPeriodStart === undefined) currentPeriodStart = game.time;
            const currentDuration = game.time - currentPeriodStart;
            if (currentDuration > maxDuration) {
              maxDuration = currentDuration;
              primeWindow = {
                start: currentPeriodStart,
                end: game.time,
                durationDays: Math.round(maxDuration / (1000 * 60 * 60 * 24))
              };
            }
          } else {
            currentPeriodStart = undefined;
          }
        }
      }

      // Calculate Nemesis & Favorite Victim
      let nemesis: { id: string; losses: number } | undefined;
      let favoriteVictim: { id: string; wins: number } | undefined;

      if (summary?.gamesDistribution) {
        const opponentStats = new Map<string, { wins: number; losses: number }>();
        summary.games.forEach(game => {
          const stats = opponentStats.get(game.oponent) ?? { wins: 0, losses: 0 };
          if (game.result === "win") stats.wins++;
          else stats.losses++;
          opponentStats.set(game.oponent, stats);
        });

        let maxLosses = 0;
        let maxWins = 0;
        opponentStats.forEach((stats, opponentId) => {
           if (stats.losses > maxLosses) {
             maxLosses = stats.losses;
             nemesis = { id: opponentId, losses: stats.losses };
           }
           if (stats.wins > maxWins) {
             maxWins = stats.wins;
             favoriteVictim = { id: opponentId, wins: stats.wins };
           }
        });
      }

      // Calculate Season Stats
      let bestSeason: { id: string; name: string; rank: number } | undefined;
      let totalSeasonRank = 0;
      let participatedSeasonsCount = 0;

      seasons.forEach((season) => {
        const leaderboard = season.getLeaderboard();
        const rankIndex = leaderboard.findIndex((p) => p.playerId === player.id);
        if (rankIndex !== -1) {
          const rank = rankIndex + 1;
          participatedSeasonsCount++;
          totalSeasonRank += rank;
          if (!bestSeason || rank < bestSeason.rank) {
             const start = new Date(season.start);
             const end = new Date(season.end);
             bestSeason = {
               id: `${season.start}`,
               name: `${start.toLocaleString('default', { month: 'short' })} ${start.getFullYear()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getFullYear()}`,
               rank
             };
          }
        }
      });

      const averageSeasonRank = participatedSeasonsCount > 0 
        ? Math.round((totalSeasonRank / participatedSeasonsCount) * 10) / 10 
        : undefined;

      // Calculate Tournament Stats
      let tournamentWins = 0;
      let tournamentFinals = 0;
      let tournamentParticipations = 0;

      tournaments.forEach(tournament => {
        const hasParticipated = tournament.signedUp.some(s => s.player === player.id);
        if (hasParticipated) {
          tournamentParticipations++;
          if (tournament.winner === player.id) {
            tournamentWins++;
            milestones.push({ type: 'tournament-win', label: `Champion: ${tournament.name}`, date: tournament.endDate ?? tournament.startDate, icon: '🏆' });
          }
          if (tournament.bracket) {
             const finalGame = tournament.bracket.bracketGames[tournament.bracket.bracketGames.length - 1]?.played[0];
             if (finalGame && (finalGame.winner === player.id || finalGame.loser === player.id)) {
               tournamentFinals++;
             }
          }
        }
      });

      const tournamentStats = { won: tournamentWins, finals: tournamentFinals, participated: tournamentParticipations };
      const daysActive = Math.max(0, Math.round((player.updatedAt - player.createdAt) / (1000 * 60 * 60 * 24)));
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

      // Legacy Score Calculation
      // 1. Peak Elo (relative to initial 1000)
      const eloScore = Math.max(0, peakElo - 1000);
      // 2. Win Rate bonus (if > 50%)
      const winRateScore = Math.max(0, (winRate - 50) * 10);
      // 3. Tournament Wins (heavy weight)
      const tournamentScore = tournamentWins * 500;
      // 4. Finals bonus
      const finalsScore = tournamentFinals * 100;
      // 5. Longevity (1 point per active day)
      const longevityScore = daysActive;
      // 6. Experience (1 point per game)
      const experienceScore = totalGames;

      const legacyScore = Math.round(eloScore + winRateScore + tournamentScore + finalsScore + longevityScore + experienceScore);

      // Final Titles
      const achievements = this.parent.achievements.getAchievements(player.id);
      const titles: string[] = [];
      if (achievements.some(a => a.type === "tournament-winner")) titles.push("🏆 Tournament Champion");
      if (achievements.some(a => a.type === "season-winner")) titles.push("🏅 Season Legend");
      if (peakElo >= 1500) titles.push("⭐ Grandmaster");
      else if (peakElo >= 1200) titles.push("🌟 Veteran");
      if (totalGames >= 500) titles.push("🏗️ Pillar of the League");
      if (winRate >= 80 && totalGames >= 50) titles.push("⚡ Dominant Force");
      if (longestStreak >= 10) titles.push("🚀 Unstoppable");
      if (pioneers.has(player.id)) titles.push("🌱 League Pioneer");

      return {
        id: player.id,
        name: player.name,
        titles,
        honors: {
          peakElo: Math.round(peakElo),
          totalGames,
          wins,
          loss,
          winRate,
          daysActive,
          longestStreak,
          nemesis,
          favoriteVictim,
          bestSeason,
          averageSeasonRank,
          tournamentStats,
          primeWindow,
          activityHeatmap,
          playStyle,
          cleanSweeps,
          legacyScore,
          legacyBreakdown: {
            eloScore,
            winRateScore,
            tournamentScore,
            finalsScore,
            longevityScore,
            experienceScore
          },
          milestones: milestones.sort((a, b) => a.date - b.date),
          rawStats: {
            gamesPlayed: totalGames,
            setsWon,
            setsLost,
            pointsScored,
            pointsConceded,
          },
        },
      };
    }).sort((a, b) => b.honors.legacyScore - a.honors.legacyScore);
  }
}
