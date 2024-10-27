import React from "react";
import { ALLOWED_FARMER_GAMES, FARMER_DIFF_THRESHOLD, FARMER_GAME_LIMIT } from "../wrappers/leaderboard";

export const FarmerScorePage: React.FC = () => {
  const [exampleFarmerGames, setExampleFarmerGames] = React.useState(5);

  return (
    <div className="flex flex-col items-center">
      <section className="max-w-96">
        <h1>Farmer score</h1>
        <p>From 0 to 10.</p>
        <p>10 is the worst score.</p>
        <br />
        <h2>How its calculated</h2>
        <p>
          Its the ratio of farming games in your <b> last {FARMER_GAME_LIMIT} games</b>.
        </p>
        <p>You are allowed {ALLOWED_FARMER_GAMES} farming games before they are counted towards your score.</p>
        <br />
        <h2>What counts as a farming game?</h2>
        <p>A game you win where the oponent has at least {FARMER_DIFF_THRESHOLD} points lower Elo score than you.</p>
        <br />
        <h2>Example</h2>
        <div className="flex gap-2">
          <button
            disabled={exampleFarmerGames >= FARMER_GAME_LIMIT}
            className="px-4 py-1 rounded-md bg-blue-500 hover:bg-blue-700"
            onClick={() => setExampleFarmerGames(exampleFarmerGames + 1)}
          >
            +
          </button>
          <button
            disabled={exampleFarmerGames <= 0}
            className="px-4 py-1 rounded-md bg-blue-500 hover:bg-blue-700"
            onClick={() => setExampleFarmerGames(exampleFarmerGames - 1)}
          >
            -
          </button>
        </div>
        <br />
        <p>
          {exampleFarmerGames} farming games in your last {FARMER_GAME_LIMIT} games
        </p>
        <br />
        <p>
          ({exampleFarmerGames} - {ALLOWED_FARMER_GAMES}) / ({FARMER_GAME_LIMIT} - {ALLOWED_FARMER_GAMES})
        </p>
        <p>
          {exampleFarmerGames - ALLOWED_FARMER_GAMES} / {FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES} ={" "}
          {(exampleFarmerGames - ALLOWED_FARMER_GAMES) / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)}
        </p>
        <p>
          {(exampleFarmerGames - ALLOWED_FARMER_GAMES) / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)} * 10 ={" "}
          {((exampleFarmerGames - ALLOWED_FARMER_GAMES) / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)) * 10}
        </p>
        <p className="text-base font-bold">
          Farmer score is:{" "}
          <b>
            {" "}
            {Math.max(
              ((exampleFarmerGames - ALLOWED_FARMER_GAMES) / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)) * 10,
              0,
            )}
          </b>{" "}
        </p>
      </section>
    </div>
  );
};
