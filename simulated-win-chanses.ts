const SIMULATION_ITERATIONS = 1_000_000;

/**
 * Simulate a single ball
 */
function simulateBall(ballWinChance: number): boolean {
  return Math.random() < ballWinChance;
}

/**
 * Simulate a single set
 */
function simulateSet(ballWinChance: number, setPoints: number = 11): boolean {
  let myPoints = 0;
  let oppPoints = 0;

  while (Math.max(myPoints, oppPoints) < setPoints || Math.abs(myPoints - oppPoints) < 2) {
    if (simulateBall(ballWinChance)) {
      myPoints++;
    } else {
      oppPoints++;
    }
  }

  return myPoints > oppPoints;
}

/**
 * Simulate a complete game (best of sets)
 */
function simulateGame(setWinChance: number, totalSets: number = 3): boolean {
  const setsToWin = Math.ceil(totalSets / 2);
  let mySets = 0;
  let oppSets = 0;

  while (mySets < setsToWin && oppSets < setsToWin) {
    if (Math.random() < setWinChance) {
      mySets++;
    } else {
      oppSets++;
    }
  }

  return mySets > oppSets;
}

/**
 * Simulate a complete game starting from ball win chance
 */
function simulateGameFromBall(ballWinChance: number, setPoints: number = 11, totalSets: number = 3): boolean {
  const setsToWin = Math.ceil(totalSets / 2);
  let mySets = 0;
  let oppSets = 0;

  while (mySets < setsToWin && oppSets < setsToWin) {
    if (simulateSet(ballWinChance, setPoints)) {
      mySets++;
    } else {
      oppSets++;
    }
  }

  return mySets > oppSets;
}

/**
 * Generate a lookup table for game win probability given ball win chance
 * Returns an array of length 101 where index i represents ball win chance of i/100
 * Uses Monte Carlo simulation with 100,000 games per data point
 */
export function generateGameWinProbabilityFromBall(
  setPoints: number = 11,
  totalSets: number = 3,
  simulations: number = SIMULATION_ITERATIONS,
): number[] {
  const table: number[] = [];

  for (let i = 0; i <= 100; i++) {
    const ballWinChance = i / 100;
    let wins = 0;

    // Run simulations
    for (let sim = 0; sim < simulations; sim++) {
      if (simulateGameFromBall(ballWinChance, setPoints, totalSets)) {
        wins++;
      }
    }

    const gameWinProbability = wins / simulations;
    table.push(gameWinProbability);
  }

  return table;
}

/**
 * Generate a lookup table for game win probability given set win chance
 * Returns an array of length 101 where index i represents set win chance of i/100
 * Uses Monte Carlo simulation with 100,000 games per data point
 */
export function generateGameWinProbabilityFromSet(
  totalSets: number = 3,
  simulations: number = SIMULATION_ITERATIONS,
): number[] {
  const table: number[] = [];

  for (let i = 0; i <= 100; i++) {
    const setWinChance = i / 100;
    let wins = 0;

    // Run simulations
    for (let sim = 0; sim < simulations; sim++) {
      if (simulateGame(setWinChance, totalSets)) {
        wins++;
      }
    }

    const gameWinProbability = wins / simulations;
    table.push(gameWinProbability);
  }

  return table;
}

function generateGameWinProbabilityFromGame(): number[] {
  const table: number[] = [];

  for (let i = 0; i <= 100; i++) {
    table.push(i / 100);
  }

  return table;
}

// Example usage and testing
// console.log("Generating Game Win Probability Table from Ball Win Chance...");

// const gameFromBallTable = generateGameWinProbabilityFromBall();
// console.log(gameFromBallTable.slice(0, 51));
// console.log(gameFromBallTable.slice(51));

// console.log("\n\nGenerating Game Win Probability Table from Set Win Chance...");

// const gameFromSetTable = generateGameWinProbabilityFromSet();
// console.log(gameFromSetTable.slice(0, 51));
// console.log(gameFromSetTable.slice(51));

console.log("\n\nGenerating Game Win Probability Table from Game Win Chance...");

const gameFromGameTable = generateGameWinProbabilityFromGame();
console.log(gameFromGameTable.slice(0, 51));
console.log(gameFromGameTable.slice(51));
