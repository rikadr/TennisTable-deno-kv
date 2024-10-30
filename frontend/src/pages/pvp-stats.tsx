import { useClientDbContext } from "../wrappers/client-db-context";
import { classNames } from "../common/class-names";

type Props = {
  player1?: string;
  player2?: string;
};

export const PvPStats: React.FC<Props> = ({ player1, player2 }) => {
  const context = useClientDbContext();

  if (!player1 || !player2) {
    return <div>Please select players</div>;
  }
  const { player1: p1, player2: p2 } = context.pvp.compare(player1, player2);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <WinsPillar name={p1.name} wins={p1.wins} oponentWins={p2.wins} />
        <WinsPillar name={p2.name} wins={p2.wins} oponentWins={p1.wins} />
      </div>
      <div className="flex gap-2 justify-around">
        <section>
          <p>Longest streak: {p1.streak.longest}</p>
          <p>Current streak: {p1.streak.current}</p>
        </section>
        <section>
          <p>Longest streak: {p2.streak.longest}</p>
          <p>Current streak: {p2.streak.current}</p>
        </section>
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
      <div className="text-5xl font-semibold sm:text-6xl">{wins}</div>
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="grow" />
      {!showTextInside && winsText()}
      <div
        className="w-full mt-1 py-1 flex flex-col justify-between items-center bg-secondary-background rounded-t-3xl transition-all duration-500"
        style={{ height: `${pillarHeight}px` }}
      >
        {showTextInside && winsText()}
        <div className="grow" />
        <p className="text-secondary-text text-xl sm:text-2xl md:text-3xl uppercase font-bold tracking-tight">
          {name}{" "}
        </p>
      </div>
    </div>
  );
};
