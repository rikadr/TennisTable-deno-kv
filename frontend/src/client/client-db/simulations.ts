import { Elo } from "./elo";
import { Game } from "./event-store/projectors/games-projector";
import { TennisTable } from "./tennis-table";

export class Simulations {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  expectedWinLoss(diffElo: number, gamesToSimulate: number = 1_000): number {
    let player1Elo = 1_000;
    let player2Elo = player1Elo + diffElo;
    let wins = 0;
    let loss = 0;

    for (let i = 1; i <= gamesToSimulate; i++) {
      const player1mustWin = player2Elo - player1Elo > diffElo;
      if (player1mustWin) {
        wins++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player1Elo, player2Elo, i, i);
        player1Elo = winnersNewElo;
        player2Elo = losersNewElo;
      } else {
        loss++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player2Elo, player1Elo, i, i);
        player1Elo = losersNewElo;
        player2Elo = winnersNewElo;
      }
    }
    return wins / (loss ?? 1);
  }

  expectedLeaderBoard(): {
    current: { id: string; rank: number; score: number }[];
    expected: { id: string; rank: number; score: number }[];
  } {
    //
    const currentLeaderboard = this.parent.leaderboard.getLeaderboard();

    const rankedPlayers = this.parent.players.filter((player) =>
      currentLeaderboard.rankedPlayers.some((entry) => entry.id === player.id),
    );
    const allGamesWithActivePlayers = this.parent.games.filter(
      (game) =>
        this.parent.eventStore.playersProjector.getPlayer(game.winner)?.active &&
        this.parent.eventStore.playersProjector.getPlayer(game.loser)?.active,
    );
    const generatedGames = this.parent.futureElo.simulatedGamesForAGivenInputOfGames(allGamesWithActivePlayers);
    const totalGames = [...allGamesWithActivePlayers, ...generatedGames];

    const simResultMap = new Map<string, number[]>();

    for (let i = 0; i < 5_000; i++) {
      this.shuffleArray(totalGames);
      // Casting, but its only using winner and loser inside it anyway
      const eloMap = Elo.eloCalculator(totalGames as Game[], rankedPlayers);
      eloMap.forEach((player) => {
        if (simResultMap.has(player.id) === false) {
          simResultMap.set(player.id, []);
        }
        simResultMap.get(player.id)!.push(player.elo);
      });
    }

    const avgSimResult: { id: string; rank: number; score: number }[] = [];
    simResultMap.forEach((scores, playerId) =>
      avgSimResult.push({
        id: playerId,
        rank: -1,
        score: scores.reduce((acc, cur) => (acc += cur), 0) / scores.length,
      }),
    );
    avgSimResult.sort((a, b) => b.score - a.score);

    return {
      current: currentLeaderboard.rankedPlayers.map(({ id, rank, elo }) => ({ id, rank, score: elo })),
      expected: avgSimResult.map((player, index) => ({ ...player, rank: index + 1 })),
    };
  }

  expectedPlayerEloOverTime(
    playerId: string,
    workerCallback: (message: { elements: { elo: number; time: number }[]; progress: number }) => void,
  ): void {
    const player = this.parent.eventStore.playersProjector.getPlayer(playerId);
    if (!player) return;

    const allGamesWithActivePlayers = this.parent.games.filter(
      (game) =>
        this.parent.eventStore.playersProjector.getPlayer(game.winner)?.active &&
        this.parent.eventStore.playersProjector.getPlayer(game.loser)?.active,
    );

    const playerGameTimes = new Set<number>();
    for (let i = 0; i < allGamesWithActivePlayers.length; i++) {
      const game = allGamesWithActivePlayers[i];
      const isPlayedByPlayer = [game.winner, game.loser].includes(playerId);
      if (isPlayedByPlayer) {
        playerGameTimes.add(game.playedAt);
        const gameBefore = allGamesWithActivePlayers[i - 1];
        if (gameBefore) {
          playerGameTimes.add(gameBefore.playedAt);
        }
      }
    }
    // Add latest game
    playerGameTimes.add(allGamesWithActivePlayers[allGamesWithActivePlayers.length - 1].playedAt);

    const sortedPlayerGameTimes = Array.from(playerGameTimes).sort((a, b) => a - b); // Verify ascending
    const playerPlayedTheLastGame =
      allGamesWithActivePlayers[allGamesWithActivePlayers.length - 1].winner === playerId ||
      allGamesWithActivePlayers[allGamesWithActivePlayers.length - 1].loser === playerId;

    const BATCH_SIZE = 1; // 5 seems reasonable but 1 works well on my beast mac and gives smooth frame rate

    const FAST_ITERATION = 50;
    const DETAILED_ITERATION = 3_000;

    const totalIterationsToSimulate =
      FAST_ITERATION * sortedPlayerGameTimes.length + DETAILED_ITERATION * (playerPlayedTheLastGame ? 2 : 3);
    let iterationsProgress = 0;

    let eloOverTime: { elo: number; time: number }[] = [];

    for (const gameTime of sortedPlayerGameTimes.toReversed()) {
      const relevantGames = allGamesWithActivePlayers.filter((g) => g.playedAt <= gameTime);
      const generatedGames = this.parent.futureElo.simulatedGamesForAGivenInputOfGames(relevantGames);
      const totalGames = [...relevantGames, ...generatedGames];

      const playerElos: number[] = [];

      const iterations =
        gameTime >= sortedPlayerGameTimes[sortedPlayerGameTimes.length - (playerPlayedTheLastGame ? 2 : 3)]
          ? DETAILED_ITERATION
          : FAST_ITERATION;

      for (let i = 0; i < iterations; i++) {
        this.shuffleArray(totalGames);
        const eloMap = Elo.eloCalculator(
          totalGames as Game[], // Casting, but its only using winner and loser inside it anyway
          this.parent.eventStore.playersProjector.players.filter((p) => p.active),
        );
        const playerElo = eloMap.get(playerId)?.elo;
        playerElo && playerElos.push(playerElo);
      }
      if (playerElos.length === 0) {
        continue;
      }
      const avg = playerElos.reduce((acc, cur) => acc + cur, 0) / playerElos.length;
      eloOverTime.push({ elo: avg, time: gameTime });

      // Tally-up and do worker callback
      iterationsProgress += iterations;
      if (
        eloOverTime.length >= BATCH_SIZE ||
        iterations === DETAILED_ITERATION ||
        gameTime === sortedPlayerGameTimes[sortedPlayerGameTimes.length - 1]
      ) {
        const progress = iterationsProgress / totalIterationsToSimulate;
        workerCallback({ elements: [...eloOverTime], progress });
        eloOverTime = [];
      }
    }

    return;
  }

  // Fisher-Yates Shuffle
  shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
  }
}
