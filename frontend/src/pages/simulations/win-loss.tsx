import React from "react";
import { useClientDbContext } from "../../wrappers/client-db-context";

export const WinLoss: React.FC = () => {
  const {
    simulations: { expectedWinLoss },
  } = useClientDbContext();
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-6 text-2xl">Expected winn/loss rate</h1>
      <p>Points difference ----- Expected win rate ----- % win chanse</p>
      {[...Array(51).keys()].map((diff) => {
        const result = expectedWinLoss(-diff * 10);
        return (
          <div key={diff} className="flex border-b-[0.5px] border-primary-text/50 hover:bg-secondary-background/50">
            <div className="w-10 text-right">{diff * 10}</div>
            <div className="w-16 text-right">
              {result.toLocaleString("no-NO", {
                maximumFractionDigits: 1,
              })}{" "}
              : 1
            </div>
            <div className="w-16 text-right">
              {((result / (1 + result)) * 100).toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })}{" "}
              %
            </div>
          </div>
        );
      })}
    </div>
  );
};
