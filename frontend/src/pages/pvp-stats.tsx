import { useClientDbContext } from "../wrappers/client-db-context";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import { timeAgo } from "../common/date-utils";

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
          <p className="text-lg font-semibold text-center mb-1">
            {Math.round((p1.wins / games.length) * 100) || "-"} %
          </p>
          <p>Longest streak: {p1.streak.longest}</p>
          <p>Current streak: {p1.streak.current}</p>
        </section>
        <section>
          <p className="text-lg font-semibold text-center mb-1">
            {Math.round((p2.wins / games.length) * 100) || "-"} %
          </p>
          <p>Longest streak: {p2.streak.longest}</p>
          <p>Current streak: {p2.streak.current}</p>
        </section>
      </div>
      <div className="w-fit m-auto">
        <div className="flex flex-col divide-y divide-primary-text/50">
          <div className="flex gap-4 text-base text-center mb-2">
            <div className="w-32 text-left pl-2">Winner</div>
            {/* <div className="w-12 pl-4 whitespace-nowrap">Elo +-</div> */}
            <div className="w-32 text-right">Time</div>
          </div>
          {games.map((_, index, list) => {
            const game = list[list.length - 1 - index];
            return (
              <Link
                key={p1.name + p2.name + index}
                to={`/player/${game.winner}`}
                className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
              >
                <div className="w-48 font-normal whitespace-nowrap flex gap-4">
                  <div className="w-5 shrink-0">{p1.name === game.winner && "🏆"}</div>
                  {game.winner}
                  <div className="w-5 shrink-0">{p2.name === game.winner && "🏆"}</div>
                </div>
                {/* <div className="w-12 text-right">
                {(0).toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div> */}
                <div className="w-32 text-right text-base">{timeAgo(new Date(game.time))}</div>
              </Link>
            );
          })}
        </div>{" "}
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

  const heightPerWin = (MAX_HEIGHT - BASE_HEIGHT) / (Math.max(wins, oponentWins) || 1);
  const pillarHeight = BASE_HEIGHT + wins * heightPerWin;
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
