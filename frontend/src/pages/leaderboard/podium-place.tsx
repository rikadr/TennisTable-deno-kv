import { Link } from "react-router-dom";
import { PlayerSummary } from "../../client/client-db/types";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ThemedPlaceNumber } from "./themed-place-number";

const cardHeight: Record<Props["size"], string> = {
  default: "h-[5rem]",
  sm: "h-[4.4rem]",
  xs: "h-[4rem]",
};

const profilePictureSize: Record<Props["size"], number> = {
  default: 64 + 3,
  sm: 54.4 + 3,
  xs: 48 + 3,
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

type Props = {
  playerSummary?: PlayerSummary;
  size: "default" | "sm" | "xs";
  place?: number;
  profilePicture?: boolean;
  score?: number;
  to?: string;
};

export const PodiumPlace: React.FC<Props> = ({ playerSummary, place, size, profilePicture = false, score, to }) => {
  const context = useEventDbContext();
  return (
    <Link
      to={to ?? `/player/${playerSummary!.id}`}
      className={classNames(
        "w-full p-2 rounded-lg flex space-x-4 h-20 bg-secondary-background hover:bg-secondary-background/70",
        cardHeight[size],
      )}
    >
      <div className="w-16 flex items-center justify-center shrink-0">
        <ThemedPlaceNumber place={place} size={size} />
      </div>
      <section className="grow text-secondary-text">
        <h2 className={classNames("uppercase", nameTextSize[size])}>{context.playerName(playerSummary?.id)} </h2>
        <section className={classNames("flex space-x-4 font-medium", statsTextSize[size])}>
          <div>
            {score !== undefined
              ? score.toLocaleString("no-NO", { maximumFractionDigits: 0 })
              : playerSummary
              ? playerSummary.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })
              : "-"}
          </div>
          <div>
            🏆:💔
            {playerSummary
              ? (playerSummary.wins / playerSummary.loss).toLocaleString("no-NO", {
                  maximumFractionDigits: 1,
                })
              : "-"}
          </div>
        </section>
      </section>
      {profilePicture && (
        <div className="w-16 flex items-center justify-center shrink-0">
          <ProfilePicture
            playerId={playerSummary!.id}
            size={profilePictureSize[size]}
            shape="circle"
            clickToEdit={false}
            border={3}
          />
        </div>
      )}
    </Link>
  );
};
