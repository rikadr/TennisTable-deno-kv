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
    peakRank?: number;
    nemesis?: { id: string; losses: number };
    favoriteVictim?: { id: string; wins: number };
    bestSeason?: { id: string; name: string; rank: number };
    averageSeasonRank?: number;
    tournamentStats?: {
      won: number;
      finals: number;
      participated: number;
    };
    activityHeatmap?: { [date: string]: number };
    legacyScore: number;
    milestones: { type: string; label: string; date: number; icon: string }[];
    rawStats?: {
      gamesPlayed: number;
      setsWon: number;
      setsLost: number;
      pointsScored: number;
      pointsConceded: number;
      gamesWithSets: number;
      gamesWithPoints: number;
      estimatedTotalSets: number;
      estimatedTotalPoints: number;
    };
    knockoutStats?: {
      played: number;
      won: number;
      winRate: number;
    };
    legacyBreakdown?: {
      eloScore: number;
      tournamentScore: number;
      longevityScore: number;
      experienceScore: number;
      dataScore: number;
      seasonsScore: number;
      achievementsScore: number;
      opponentsScore: number;
      peakRankScore: number;
    };
    tournamentProgressionCounts?: {
      win: number;
      final: number;
      semi: number;
      quarter: number;
      eights: number;
      bracket: number;
      participation: number;
    };
    seasonProgressionCounts?: {
      win: number;
      top3: number;
      top5: number;
      top10: number;
      participation: number;
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

    // Force recalculation to ensure we catch all achievements
    this.parent.achievements.forceRecalculate();
    const seasons = this.parent.seasons.getSeasons();
    const tournaments = this.parent.tournaments.getTournaments();

    // 1. Calculate historical peak ranks for all players
    const peakRankMap = new Map<string, number>();
    const currentEloMap = new Map<string, number>();
    this.parent.allPlayers.forEach(p => currentEloMap.set(p.id, Elo.INITIAL_ELO));

    Elo.eloCalculator(this.parent.games, this.parent.allPlayers, (eloMap, game) => {
      // Update elos
      currentEloMap.set(game.winner, eloMap.get(game.winner)!.elo);
      currentEloMap.set(game.loser, eloMap.get(game.loser)!.elo);

      // Identify who is ranked (met game limit at this point in time)
      // This is slightly complex as we need to track game counts per player per time
      // For performance, we'll approximate: if they ever became ranked, what was their best position when they were ranked.
    });

    // Actually, it's easier to use the summary data's elo history and compare against other players' elo at that time
    // but that is O(G * P).
    // Let's use a more efficient approach: use the games to track elo and rank in one pass.
    const gameCounts = new Map<string, number>();
    this.parent.allPlayers.forEach(p => gameCounts.set(p.id, 0));
    
    Elo.eloCalculator(this.parent.games, this.parent.allPlayers, (eloMap, game) => {
      gameCounts.set(game.winner, (gameCounts.get(game.winner) || 0) + 1);
      gameCounts.set(game.loser, (gameCounts.get(game.loser) || 0) + 1);

      const rankedPlayersAtTime = this.parent.allPlayers
        .filter(p => (gameCounts.get(p.id) || 0) >= this.parent.client.gameLimitForRanked)
        .map(p => ({ id: p.id, elo: eloMap.get(p.id)!.elo }))
        .sort((a, b) => b.elo - a.elo);

      rankedPlayersAtTime.forEach((p, index) => {
        const rank = index + 1;
        const currentPeak = peakRankMap.get(p.id) || Infinity;
        if (rank < currentPeak) {
          peakRankMap.set(p.id, rank);
        }
      });
    });

    const pioneers = new Set(
      this.parent.allPlayers
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 10)
        .map((p) => p.id),
    );

    // Calculate global averages from all games for fallback when players have no data
    let globalSetsTotal = 0;
    let globalPointsTotal = 0;
    let globalGamesWithSets = 0;
    let globalGamesWithPoints = 0;

    for (const game of this.parent.games) {
      if (game.score?.setsWon) {
        globalSetsTotal += game.score.setsWon.gameWinner + game.score.setsWon.gameLoser;
        globalGamesWithSets++;
      }
      if (game.score?.setPoints) {
        let hasPoints = false;
        for (const set of game.score.setPoints) {
          const totalPoints = set.gameWinner + set.gameLoser;
          if (totalPoints > 0) {
            globalPointsTotal += totalPoints;
            hasPoints = true;
          }
        }
        if (hasPoints) globalGamesWithPoints++;
      }
    }

    const globalAvgSetsPerGame = globalGamesWithSets > 0 ? globalSetsTotal / globalGamesWithSets : 0;
    const globalAvgPointsPerGame = globalGamesWithPoints > 0 ? globalPointsTotal / globalGamesWithPoints : 0;

    return deactivatedPlayers
      .map((player) => {
        const summary = this.parent.leaderboard.getPlayerSummary(player.id);

        const wins = summary?.wins ?? 0;
        const loss = summary?.loss ?? 0;
        const totalGames = wins + loss;

        const milestones: { type: string; label: string; date: number; icon: string }[] = [
          { type: "joined", label: "Inducted into League", date: player.createdAt, icon: "🌱" },
        ];

        let peakElo = Elo.INITIAL_ELO;
        let peakEloDate = player.createdAt;
        let currentStreak = 0;
        let longestStreak = 0;

        let setsWon = 0;
        let setsLost = 0;
        let pointsScored = 0;
        let pointsConceded = 0;
        let gamesWithSets = 0;
        let gamesWithPoints = 0;

        const sortedGames = [...(summary?.games ?? [])].sort((a, b) => a.time - b.time);

        if (sortedGames.length > 0) {
          milestones.push({ type: "first-game", label: "First Professional Match", date: sortedGames[0].time, icon: "🏓" });

          for (const game of sortedGames) {
            if (game.eloAfterGame > peakElo) {
              peakElo = game.eloAfterGame;
              peakEloDate = game.time;
            }

            if (game.score?.setsWon) {
              const isWinner = game.result === "win";
              const mySets = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
              const oppSets = isWinner ? game.score.setsWon.gameLoser : game.score.setsWon.gameWinner;
              setsWon += mySets;
              setsLost += oppSets;
              gamesWithSets++;
            }

            if (game.score?.setPoints) {
              const isWinner = game.result === "win";
              let hasPointsInThisGame = false;
              for (const set of game.score.setPoints) {
                const myPoints = isWinner ? set.gameWinner : set.gameLoser;
                const oppPoints = isWinner ? set.gameLoser : set.gameWinner;
                pointsScored += myPoints;
                pointsConceded += oppPoints;
                if (myPoints > 0 || oppPoints > 0) hasPointsInThisGame = true;
              }
              if (hasPointsInThisGame) gamesWithPoints++;
            }

            if (game.result === "win") {
              currentStreak++;
            } else {
              currentStreak = 0;
            }
            if (currentStreak > longestStreak) {
              longestStreak = currentStreak;
            }
          }
        }

        // Calculate activity heatmap by processing all games directly
        const activityHeatmap: { [date: string]: number } = {};
        for (const game of this.parent.games) {
          if (game.winner === player.id || game.loser === player.id) {
            const dateKey = new Date(game.playedAt).toISOString().split("T")[0];
            activityHeatmap[dateKey] = (activityHeatmap[dateKey] || 0) + 1;
          }
        }

        // Use player's own average if they have data, otherwise use global average
        const avgSetsPerGame = gamesWithSets > 0
          ? (setsWon + setsLost) / gamesWithSets
          : globalAvgSetsPerGame;
        const avgPointsPerGame = gamesWithPoints > 0
          ? (pointsScored + pointsConceded) / gamesWithPoints
          : globalAvgPointsPerGame;
        const estimatedTotalSets = Math.round(avgSetsPerGame * totalGames);
        const estimatedTotalPoints = Math.round(avgPointsPerGame * totalGames);

              if (peakElo > Elo.INITIAL_ELO && sortedGames.length > 5) {
                milestones.push({ type: "peak-elo", label: "Reached Career Peak Elo", date: peakEloDate, icon: "⚡" });
                milestones.push({
                  type: "last-game",
                  label: "Final League Match",
                  date: sortedGames[sortedGames.length - 1].time,
                  icon: "🏁",
                });
              }
        let nemesis: { id: string; losses: number } | undefined;
        let favoriteVictim: { id: string; wins: number } | undefined;

        if (summary?.gamesDistribution) {
          const opponentStats = new Map<string, { wins: number; losses: number }>();
          summary.games.forEach((game) => {
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

        let bestSeason: { id: string; name: string; rank: number } | undefined;
        let totalSeasonRank = 0;
        let participatedSeasonsCount = 0;
        let seasonsScore = 0;
        const seasonCounts = {
          win: 0,
          top3: 0,
          top5: 0,
          top10: 0,
          participation: 0,
        };

        seasons.forEach((season) => {
          const lBoard = season.getLeaderboard();
          const rankIndex = lBoard.findIndex((p) => p.playerId === player.id);
          if (rankIndex !== -1) {
            const rank = rankIndex + 1;
            participatedSeasonsCount++;
            totalSeasonRank += rank;

            // Season Score Logic
            seasonsScore += 10; // Participation
            seasonCounts.participation++;

            if (rank === 1) {
              seasonsScore += 100;
              seasonCounts.win++;
            } else if (rank <= 3) {
              seasonsScore += 50;
              seasonCounts.top3++;
            } else if (rank <= 5) {
              seasonsScore += 25;
              seasonCounts.top5++;
            } else if (rank <= 10) {
              seasonsScore += 10;
              seasonCounts.top10++;
            }

            if (!bestSeason || rank < bestSeason.rank) {
              const start = new Date(season.start);
              const end = new Date(season.end);
              bestSeason = {
                id: `${season.start}`,
                name: `${start.toLocaleString("default", { month: "short" })} ${start.getFullYear()} - ${end.toLocaleString("default", { month: "short" })} ${end.getFullYear()}`,
                rank,
              };
            }
          }
        });

        const averageSeasonRank =
          participatedSeasonsCount > 0 ? Math.round((totalSeasonRank / participatedSeasonsCount) * 10) / 10 : undefined;

              let tournamentWins = 0;
              let tournamentFinals = 0;
              let tournamentScore = 0;
              let tournamentParticipations = 0;
              let knockoutGamesPlayed = 0;
              let knockoutGamesWon = 0;
        
              const progressionCounts = {
                win: 0,
                final: 0,
                semi: 0,
                quarter: 0,
                eights: 0,
                bracket: 0,
                participation: 0,
              };
        
                              tournaments.forEach((tournament) => {
        
                                const achievements = this.parent.achievements.getAchievements(player.id);
        
                                const hasWinnerAchievement = achievements.some(a => a.type === "tournament-winner" && a.data.tournamentId === tournament.id);
        
                                const hasParticipated = 
        
                                  tournament.signedUp.some((s) => s.player === player.id) || 
        
                                  tournament.tournamentDb.playerOrder?.includes(player.id) ||
        
                                  hasWinnerAchievement;
        
                                
        
                                if (hasParticipated) {
        
                                  tournamentParticipations++;
        
                                  let roundReached = -1;
        
                                  const isWinner = tournament.winner === player.id || hasWinnerAchievement;
        
              
        
                          if (tournament.bracket) {
        
                            // Track all knockout games for this player in this tournament
        
                            tournament.bracket.bracketGames.forEach((layer) => {
        
                              layer.played.forEach((game) => {
        
                                if (game.player1 === player.id || game.player2 === player.id) {
        
                                  knockoutGamesPlayed++;
        
                                  if (game.winner === player.id) {
        
                                    knockoutGamesWon++;
        
                                  }
        
                                }
        
                              });
        
                            });
        
              
        
                            // Find the highest round reached (layer 0 is Final, layer 1 is Semis, etc.)
        
                            // We search through the bracket definition to see where the player's ID appears
        
                            for (let layerIndex = 0; layerIndex < tournament.bracket.bracket.length; layerIndex++) {
        
                              const layer = tournament.bracket.bracket[layerIndex];
        
                              const wasInRound = layer.some((game) => game.player1 === player.id || game.player2 === player.id);
        
                              if (wasInRound) {
        
                                roundReached = layerIndex;
        
                                break;
        
                              }
        
                            }
        
                          }
        
              
        
                          if (isWinner) {
        
                            tournamentWins++;
        
                            tournamentScore += 500;
        
                            progressionCounts.win++;
        
                            milestones.push({
        
                              type: "tournament-win",
        
                              label: `Champion: ${tournament.name}`,
        
                              date: tournament.endDate ?? tournament.startDate,
        
                              icon: "🏆",
        
                            });
        
                          } else if (roundReached === 0) {
        
                            tournamentFinals++;
        
                            tournamentScore += 300;
        
                            progressionCounts.final++;
        
                          } else if (roundReached === 1) {
        
                            tournamentScore += 200;
        
                            progressionCounts.semi++;
        
                          } else if (roundReached === 2) {
        
                            tournamentScore += 125;
        
                            progressionCounts.quarter++;
        
                          } else if (roundReached === 3) {
        
                            tournamentScore += 75;
        
                            progressionCounts.eights++;
        
                          } else if (roundReached !== -1) {
        
                            tournamentScore += 60;
        
                            progressionCounts.bracket++;
        
                          } else {
        
                            tournamentScore += 50;
        
                            progressionCounts.participation++;
        
                          }
        
                        }
        
                      });        const tournamentStats = { won: tournamentWins, finals: tournamentFinals, participated: tournamentParticipations };

        // Longevity: from first game to deactivation. 0 if no games played.
        const firstGameTime = sortedGames.length > 0 ? sortedGames[0].time : null;
        const deactivationTime = player.deactivatedAt ?? player.updatedAt;
        const daysActive = firstGameTime ? Math.max(0, Math.round((deactivationTime - firstGameTime) / (1000 * 60 * 60 * 24))) : 0;

        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

        const eloScore = Math.max(0, peakElo - 1000);
        const tournamentScoreFinal = tournamentScore;
        const longevityScore = daysActive;
        const experienceScore = totalGames * 3;
        const dataScore = Math.round((setsWon + setsLost) * 1 + (pointsScored + pointsConceded) * 0.1);

        const achievements = this.parent.achievements.getAchievements(player.id);
        const achievementsScore = achievements.length * 20;

        const uniqueOpponentsCount = new Set(sortedGames.map((g) => g.oponent)).size;
        const opponentsScore = uniqueOpponentsCount * 20;

        const peakRank = peakRankMap.get(player.id);
        let peakRankScore = 0;
        if (peakRank === 1) peakRankScore = 300;
        else if (peakRank && peakRank <= 3) peakRankScore = 100;
        else if (peakRank && peakRank <= 5) peakRankScore = 50;
        else if (peakRank && peakRank <= 10) peakRankScore = 25;

        const legacyScore = Math.round(
          eloScore +
            tournamentScoreFinal +
            longevityScore +
            experienceScore +
            dataScore +
            seasonsScore +
            achievementsScore +
            opponentsScore +
            peakRankScore,
        );

        const titles: string[] = [];
        if (achievements.some((a) => a.type === "tournament-winner")) titles.push("🏆 Tournament Champion");
        if (achievements.some((a) => a.type === "season-winner")) titles.push("🏅 Season Legend");
        if (peakElo >= 1500) titles.push("⭐ Grandmaster");
        else if (peakElo >= 1200) titles.push("🌟 Veteran");
        if (totalGames >= 500) titles.push("🏗️ Pillar of the League");
        if (winRate >= 80 && totalGames >= 50) titles.push("⚡ Dominant Force");
        if (longestStreak >= 10) titles.push("🚀 Unstoppable");
        if (pioneers.has(player.id)) titles.push("🌱 League Pioneer");
        if (tournamentParticipations >= 5) titles.push("🏟️ Tournament Regular");

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
                      peakRank,
                      nemesis,
                      favoriteVictim,
                      bestSeason,
                      averageSeasonRank,
                      tournamentStats,
                      activityHeatmap,
                      legacyScore,
                      legacyBreakdown: {
                        eloScore,
                        tournamentScore: tournamentScoreFinal,
                        longevityScore,
                        experienceScore,
                        dataScore,
                        seasonsScore,
                        achievementsScore,
                        opponentsScore,
                        peakRankScore,
                      },            tournamentProgressionCounts: progressionCounts,
            seasonProgressionCounts: seasonCounts,
            knockoutStats: {
              played: knockoutGamesPlayed,
              won: knockoutGamesWon,
              winRate: knockoutGamesPlayed > 0 ? Math.round((knockoutGamesWon / knockoutGamesPlayed) * 100) : 0,
            },
            milestones: milestones.sort((a, b) => a.date - b.date),
            rawStats: {
              gamesPlayed: totalGames,
              setsWon,
              setsLost,
              pointsScored,
              pointsConceded,
              gamesWithSets,
              gamesWithPoints,
              estimatedTotalSets,
              estimatedTotalPoints,
            },
          },
        };
      })
      .sort((a, b) => b.honors.legacyScore - a.honors.legacyScore);
  }
}