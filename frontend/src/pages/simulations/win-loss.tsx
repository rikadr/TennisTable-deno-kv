import React from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";

export const WinLoss: React.FC = () => {
  const {
    simulations: { expectedWinLoss },
  } = useEventDbContext();
  return (
    <div className="text-primary-text bg-primary-background rounded-lg p-4 w-full max-w-sm mx-auto">
      <h1 className="mb-6 text-2xl text-center">Expected win/loss rate</h1>
      <table className="w-full text-primary-text border-collapse">
        <thead className="border-b border-primary-text/50">
          <tr className="text-xs xs:text-sm md:text-base text-primary-text">
            <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-normal whitespace-nowrap">Points difference</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-normal whitespace-nowrap">Expected win rate</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-normal whitespace-nowrap">Win chance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-text/50">
          {[...Array(101).keys()].map((diff) => {
            const result = expectedWinLoss(-diff * 10);
            const winChance = (result / (1 + result)) * 100;
            return (
              <tr key={diff} className="hover:bg-secondary-background/30 text-xs xs:text-sm md:text-base">
                <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap">{diff * 10}</td>
                <td className="py-1 px-1 xs:px-2 md:px-3 text-right whitespace-nowrap">
                  {result.toLocaleString("no-NO", {
                    maximumFractionDigits: result > 10 ? 0 : 1,
                  })}{" "}
                  : 1
                </td>
                <td className="py-1 px-1 xs:px-2 md:px-3 text-right whitespace-nowrap">
                  {winChance.toLocaleString("no-NO", {
                    maximumFractionDigits: winChance > 90 ? 1 : 0,
                  })}{" "}
                  %
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
