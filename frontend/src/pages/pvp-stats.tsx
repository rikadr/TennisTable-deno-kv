import { useClientDbContext } from "../wrappers/client-db-context";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import { relativeTimeString } from "../common/date-utils";

type Props = {
  player1?: string;
  player2?: string;
};

export const PvPStats: React.FC<Props> = ({ player1, player2 }) => {
  const context = useClientDbContext();

  if (!player1 || !player2) {
    return <div>Please select players</div>;
  }
  const { player1: p1, player2: p2, games } = context.pvp.compare(player1, player2);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <WinsPillar name={p1.name} wins={p1.wins} oponentWins={p2.wins} />
        <WinsPillar name={p2.name} wins={p2.wins} oponentWins={p1.wins} />
      </div>
      <div className="flex gap-2 justify-around">
        <section>
          <p className="text-lg font-semibold text-center">{Math.round((p1.wins / games.length) * 100) || "-"} %</p>
          <p className="text-lg font-semibold mt-2">Streaks 🔥🏆</p>
          <p>Longest: {p1.streak.longest}</p>
          <p>Current: {p1.streak.current}</p>
          <p className="text-lg font-semibold mt-2">
            Points:{" "}
            {p1.points.currentElo.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Gained:{" "}
            {p1.points.gained.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Lost:{" "}
            {p1.points.lost.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Net:{" "}
            {(p1.points.gained - p1.points.lost).toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
        </section>
        <section>
          <p className="text-lg font-semibold text-center">{Math.round((p2.wins / games.length) * 100) || "-"} %</p>
          <p className="text-lg font-semibold mt-2">Streaks 🔥🏆</p>
          <p>Longest: {p2.streak.longest}</p>
          <p>Current: {p2.streak.current}</p>
          <p className="text-lg font-semibold mt-2">
            Points:{" "}
            {p2.points.currentElo.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Gained:{" "}
            {p2.points.gained.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Lost:{" "}
            {p2.points.lost.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p>
            Net:{" "}
            {(p2.points.gained - p2.points.lost).toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </p>
        </section>
      </div>
      <div className="w-fit m-auto">
        <div className="flex flex-col divide-y divide-primary-text/50">
          <div className="flex gap-4 text-base text-center mb-2">
            <div className="w-32 text-left pl-2">Winner</div>
            <div className="w-8 text-right pl-8 whitespace-nowrap">Elo gained</div>
            <div className="w-32 text-right">Time</div>
          </div>
          {games.map((_, index, list) => {
            const game = list[list.length - 1 - index];
            return (
              <Link
                key={p1.name + p2.name + index}
                to={`/player/${game.result === "win" ? p1.name : p2.name}`}
                className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
              >
                <div className="w-44 font-normal whitespace-nowrap flex gap-3">
                  <div className="w-5 shrink-0">{game.result === "win" && "🏆"}</div>
                  {game.result === "win" ? p1.name : p2.name}
                  <div className="w-5 shrink-0">{game.result === "loss" && "🏆"}</div>
                </div>
                <div className="w-8 text-right">
                  {Math.abs(game.pointsDiff).toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div className="w-32 text-right text-base">{relativeTimeString(new Date(game.time))}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export const WinsPillar: React.FC<{ name: string; wins: number; oponentWins: number }> = ({
  name,
  wins,
  oponentWins,
}) => {
  const BASE_HEIGHT = 45;
  const MAX_HEIGHT = 250;
  const TEXT_INSIDE_THRESHOLD = 100;

  const heightPerWin = MAX_HEIGHT / (Math.max(wins, oponentWins) || 1);
  const pillarHeight = Math.max(wins * heightPerWin, BASE_HEIGHT);
  const showTextInside = pillarHeight >= TEXT_INSIDE_THRESHOLD;

  const winsText = () => (
    <div
      className={classNames("flex flex-col items-center", showTextInside ? "text-secondary-text" : "text-primary-text")}
    >
      <div className="text-5xl font-semibold sm:text-6xl transition-all duration-500">{wins}</div>
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="grow" />
      {!showTextInside && winsText()}
      <div
        className="w-full mt-1 py-1 flex flex-col justify-between items-center bg-secondary-background rounded-t-[2rem] md:rounded-t-[3rem] transition-all duration-500"
        style={{ height: `${pillarHeight}px` }}
      >
        {showTextInside && winsText()}
        <div className="grow" />
        <p className="text-secondary-text text-xl sm:text-2xl md:text-3xl uppercase font-bold tracking-tight transition-all duration-500">
          {name}{" "}
        </p>
      </div>
    </div>
  );
};
