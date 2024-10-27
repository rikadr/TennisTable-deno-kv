import React from "react";
import { ALLOWED_FARMER_GAMES, FARMER_DIFF_THRESHOLD, FARMER_GAME_LIMIT } from "../wrappers/leaderboard";

export const FarmerScorePage: React.FC = () => {
  const exampleFarmerGames = 5;

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
        <p>A game you win where the oponent has at least {FARMER_DIFF_THRESHOLD} points lower score.</p>
        <br />
        <h2>Example</h2>
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
        <p>
          Farmer score is:{" "}
          <b> {((exampleFarmerGames - ALLOWED_FARMER_GAMES) / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)) * 10}</b>{" "}
        </p>
      </section>
    </div>
  );
};
