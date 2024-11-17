// Game config
const SET_POINTS = 11;
const GAME_SETS = 3;

// Player config
const BALL_WIN_CHANCE = 0.415;

// Simulation config
const SIMULATED_GAMES = 1_000_000;

function formatNumber(num: number): string {
  return num.toLocaleString("no-NO", { maximumFractionDigits: 2 });
}

function ballResult(): "win" | "loss" {
  return Math.random() < BALL_WIN_CHANCE ? "win" : "loss";
}

function setResult(): "win" | "loss" {
  let playerPoints = 0;
  let opponentPoints = 0;
  while (Math.max(playerPoints, opponentPoints) < SET_POINTS || Math.abs(playerPoints - opponentPoints) < 2) {
    ballResult() === "win" ? playerPoints++ : opponentPoints++;
  }
  return playerPoints > opponentPoints ? "win" : "loss";
}

function gameResult(): "win" | "loss" {
  let playerSets = 0;
  let opponentSets = 0;
  let remainingSets = GAME_SETS;

  while (remainingSets > 0 && Math.abs(playerSets - opponentSets) < remainingSets) {
    setResult() === "win" ? playerSets++ : opponentSets++;
    remainingSets--;
  }
  return playerSets > opponentSets ? "win" : "loss";
}

function simulationResult() {
  let playerGames = 0;
  let oponentGames = 0;
  for (let i = 1; i <= SIMULATED_GAMES; i++) {
    gameResult() === "win" ? playerGames++ : oponentGames++;
  }
  console.log("Ball win chanse", formatNumber(BALL_WIN_CHANCE * 100) + "%");
  console.log({ wins: formatNumber(playerGames), loss: formatNumber(oponentGames) });
  console.log("Game win chanse", formatNumber((playerGames / SIMULATED_GAMES) * 100) + "%");
  console.log("1 / " + formatNumber(oponentGames / playerGames + 1));
}

simulationResult();
