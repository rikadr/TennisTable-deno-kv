import React from "react";
import { Link } from "react-router-dom";

export const SimulationsPage: React.FC = () => {
  const simulations: { name: string; url: string }[] = [{ name: "Monte Carlo 💰", url: "monte-carlo" }];

  return (
    <div className="flex flex-col items-center">
      <h1>Simulations</h1>
      <div className="flex flex-col gap-4">
        {simulations.map(({ name, url }) => (
          <Link to={url}>{name}</Link>
        ))}
      </div>
    </div>
  );
};
