import React from "react";
import { Link } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { getClientConfig, Theme, themeOrOverrideTheme } from "../../client/client-config/get-client-config";
import { getEgg, getPumpkin } from "./themed-place-number";

export type PodiumEntry = {
  playerId: string;
  score: number;
  /** Wins per loss. Left out where it does not apply, e.g. for season scores */
  winLossRatio?: number;
  to: string;
};

const stepHeight = ["h-20 xs:h-24", "h-14 xs:h-16", "h-10 xs:h-12"];
const pictureSize = { small: [60, 48, 44], large: [80, 64, 58] };
// 2nd place to the left of 1st, 3rd to the right
const displayOrder = [1, 0, 2];

export const Podium: React.FC<{ entries: PodiumEntry[] }> = ({ entries }) => {
  const context = useEventDbContext();
  const isLarge = useMediaQuery("(min-width: 470px)");
  const theme = themeOrOverrideTheme(getClientConfig().theme);

  const placeImage = (place: number) => {
    if (theme === Theme.HALLOWEEN) return getPumpkin(place);
    if (theme === Theme.EASTER) return getEgg(place);
  };

  return (
    <div className="grid grid-cols-3 items-end gap-1.5 xs:gap-3 px-2 xs:px-3 pt-2">
      {displayOrder.map((index) => {
        const entry = entries[index];
        if (!entry) return <div key={index} />;
        const place = index + 1;
        const image = placeImage(place);
        return (
          <Link
            key={entry.playerId}
            to={entry.to}
            className="group flex flex-col items-center min-w-0 text-center"
            title={context.playerName(entry.playerId)}
          >
            <div className="transition-transform group-hover:-translate-y-0.5">
              <ProfilePicture
                playerId={entry.playerId}
                size={pictureSize[isLarge ? "large" : "small"][index]}
                border={3}
              />
            </div>
            <div
              className={classNames(
                "mt-1 w-full truncate font-normal",
                place === 1 ? "text-base xs:text-lg md:text-xl" : "text-sm xs:text-base md:text-lg",
              )}
            >
              {context.playerName(entry.playerId)}
            </div>
            <div className="flex flex-col items-center leading-tight whitespace-nowrap">
              <span className={classNames("font-medium", place === 1 ? "text-lg xs:text-xl" : "text-base xs:text-lg")}>
                {fmtNum(entry.score)}
              </span>
              {entry.winLossRatio !== undefined && (
                <span className="text-xs xs:text-sm font-light">
                  🏆:💔{" "}
                  {entry.winLossRatio.toLocaleString("no-NO", {
                    maximumFractionDigits: 1,
                  })}
                </span>
              )}
            </div>
            <div
              className={classNames(
                "mt-1 w-full rounded-t-lg flex items-start justify-center pt-1 transition-colors",
                "bg-secondary-background text-secondary-text group-hover:bg-secondary-background/80",
                stepHeight[index],
              )}
            >
              {image ? (
                <img className="h-8 xs:h-10" src={image} alt={`Place ${place}`} />
              ) : (
                <span className="text-2xl xs:text-3xl font-bold">{place}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
