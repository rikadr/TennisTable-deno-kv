import { Link } from "react-router-dom";
import { PlayerSummary } from "../wrappers/types";
import { classNames } from "../common/class-names";

type Props = {
  player: PlayerSummary;
  place: number;
  size: "default" | "sm" | "xs";
};

const cardHeight: Record<Props["size"], string> = {
  default: "h-[5rem]",
  sm: "h-[4.4rem]",
  xs: "h-[4rem]",
};

const placeBoxSize: Record<Props["size"], string> = {
  default: "w-[4rem] h-[4rem]",
  sm: "w-[3.4rem] h-[3.4rem]",
  xs: "w-[3rem] h-[3rem]",
};
const placeTextSize: Record<Props["size"], string> = {
  default: "text-5xl",
  sm: "text-4xl",
  xs: "text-3xl",
};

const nameTextSize: Record<Props["size"], string> = {
  default: "text-xl",
  sm: "text-lg",
  xs: "text-md",
};

const statsTextSize: Record<Props["size"], string> = {
  default: "text-lg",
  sm: "text-md",
  xs: "text-md",
};

export const PodiumPlace: React.FC<Props> = ({ player, place, size }) => {
  return (
    <Link
      to={`/player/${player.name}`}
      className={classNames(
        "w-full p-2 rounded-lg flex space-x-4 h-20 bg-secondary-background hover:bg-secondary-background/70",
        cardHeight[size],
      )}
    >
      <div className="w-16 flex justify-center">
        <div
          className={classNames(
            "w-16 flex justify-center items-center rounded-full bg-primary-background text-primary-text shadow-inner shadow-primary-text",
            placeBoxSize[size],
          )}
        >
          <div className={placeTextSize[size]}> {place}</div>
        </div>
      </div>
      <section className="grow text-secondary-text">
        <h2 className={classNames("uppercase", nameTextSize[size])}>{player.name} </h2>
        <section className={classNames("flex space-x-4", statsTextSize[size])}>
          <div>
            {player.elo.toLocaleString("no-NO", {
              maximumFractionDigits: 0,
            })}
          </div>
          <div>
            🏆:💔
            {(player.wins / player.loss).toLocaleString("no-NO", {
              maximumFractionDigits: 1,
            })}
          </div>
        </section>
      </section>
    </Link>
  );
};
