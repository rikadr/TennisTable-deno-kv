import { Link } from "react-router-dom";
import { PlayerSummary } from "../wrappers/types";
import { classNames } from "../common/class-names";

type Props = {
  player: PlayerSummary;
  size: "default" | "sm" | "xs";
  place?: number;
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
const placeTextSize: Record<Props["size"], string[]> = {
  default: ["text-5xl", "text-4xl", "text-3xl"],
  sm: ["text-4xl", "text-3xl", "text-2xl"],
  xs: ["text-3xl", "text-2xl", "text-xl"],
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

function getPumpkin(place?: number): string {
  if (place === 1) {
    return "https://png.pngtree.com/png-vector/20240501/ourmid/pngtree-halloween-pumpkin-horror-transparent-background-png-image_12345228.png";
  }
  if (place === 2) {
    return "https://png.pngtree.com/png-clipart/20220921/ourmid/pngtree-halloween-pumpkin-burning-png-image_6207123.png";
  }
  if (place === 3) {
    return "https://gallery.yopriceville.com/var/resizes/Free-Clipart-Pictures/Halloween-PNG-Pictures/Dark_Carved_Pumpkin_PNG_Clip_Art.png?m=1629832168";
  }

  return "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/a2dce0c6-66d0-4687-8ee5-1c76b0fa1671/dg6qz51-f605e437-ec6e-4d9d-bb01-53938e5dfb66.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcL2EyZGNlMGM2LTY2ZDAtNDY4Ny04ZWU1LTFjNzZiMGZhMTY3MVwvZGc2cXo1MS1mNjA1ZTQzNy1lYzZlLTRkOWQtYmIwMS01MzkzOGU1ZGZiNjYucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.72qQeAx1QYaxmlZXwXjg28v6rVAKDhAuj4VukNECrvk";
}

export const PodiumPlace: React.FC<Props> = ({ player, place, size }) => {
  const placeNumberLength = place?.toString().length || 1;
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
            "w-16 flex justify-center items-center rounded-full bg-primary-background text-primary-text",
            placeBoxSize[size],
          )}
        >
          {place ? (
            <div className={placeTextSize[size][placeNumberLength - 1]}>{place}</div>
          ) : (
            <div className="text-xs text-center">Not yet ranked</div>
          )}
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
      <div className="w-16 flex items-center justify-center">
        <img className={placeBoxSize[size]} src={getPumpkin(place)} alt="Pumpkin" />
      </div>
    </Link>
  );
};
