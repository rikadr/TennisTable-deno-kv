import React from "react";
import { Link } from "react-router-dom";

export const SimulationsPage: React.FC = () => {
  const simulations: { name: string; url: string }[] = [
    { name: "Monte Carlo 💰🕯️", url: "monte-carlo" },
    { name: "Expected win/loss rate 🏆💔", url: "win-loss" },
    { name: "Expected score 💯", url: "expected-score" },
  ];

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-6 text-2xl text-primary-text">Simulations</h1>
      <div className="flex flex-col gap-4 w-96">
        {simulations.map(({ name, url }) => (
          <Link
            key={url}
            className="bg-secondary-background hover:bg-secondary-background/50 rounded-md py-4 text-center text-lg text-secondary-text"
            to={url}
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  );
};
