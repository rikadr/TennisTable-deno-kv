import { Link } from "react-router-dom";
import { PlayerSummary } from "../wrappers/types";
import { classNames } from "../common/class-names";

type Props = {
  player: PlayerSummary;
  place: "1" | "2" | "3" | "last";
};

const cardHeight: Record<Props["place"], string> = {
  1: "h-[5rem]",
  2: "h-[4.2rem]",
  3: "h-[3.8rem]",
  last: "h-[3.5rem]",
};

const placeBoxSize: Record<Props["place"], string> = {
  1: "w-[4rem] h-[4rem]",
  2: "w-[3.4rem] h-[3.4rem]",
  3: "w-[3rem] h-[3rem]",
  last: "w-[2.6rem] h-[2.6rem]",
};
const placeTextSize: Record<Props["place"], string> = {
  1: "text-5xl",
  2: "text-4xl",
  3: "text-3xl",
  last: "text-2xl",
};

const nameTextSize: Record<Props["place"], string> = {
  1: "text-xl",
  2: "text-lg",
  3: "text-md",
  last: "text-sm",
};

const statsTextSize: Record<Props["place"], string> = {
  1: "text-lg",
  2: "text-md",
  3: "text-sm",
  last: "text-sm",
};

const placeText: Record<Props["place"], string> = {
  1: "1",
  2: "2",
  3: "3",
  last: "L",
};

export const PodiumPlace: React.FC<Props> = ({ player, place }) => {
  return (
    <Link
      to={`/player/${player.name}`}
      className={classNames(
        "w-full p-2 rounded-lg flex space-x-4 h-20 bg-secondary-background hover:bg-secondary-background/70",
        cardHeight[place],
      )}
    >
      <div className="w-16 flex justify-center">
        <div
          className={classNames(
            "w-16 flex justify-center items-center rounded-full bg-primary-background text-primary-text",
            placeBoxSize[place],
          )}
        >
          <div className={placeTextSize[place]}> {placeText[place]}</div>
        </div>
      </div>
      <section className="grow text-secondary-text">
        <h2 className={classNames("uppercase", nameTextSize[place])}>{player.name} </h2>
        <section className={classNames("flex space-x-4", statsTextSize[place])}>
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
