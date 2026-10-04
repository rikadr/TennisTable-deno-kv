import { Link } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";
import { buildSrc } from "@imagekit/react";
import { IMAGE_KIT_URL_ENDPOINT, useImageKitTimestamp } from "../../wrappers/image-kit-context";
import { memo, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId?: string | null;
  size?: number;
  clickToEdit?: boolean;
  border?: number;
  shape?: "circle" | "rounded";
  linkToPlayer?: boolean;
};

/** The sizes in px that ImageKit makes of a picture. Few sizes give few URLs, so the browser downloads and decodes each picture few times */
const IMAGE_SIZES = [64, 128, 256, 512];

/** The smallest image that is sharp on a screen with 2 device pixels per CSS pixel */
function imageSize(size: number): number {
  return IMAGE_SIZES.find((imageSize) => imageSize >= size * 2) ?? IMAGE_SIZES[IMAGE_SIZES.length - 1];
}

/**
 * A page can show hundreds of pictures, so this component is light: one <img> with one fixed URL and no srcset.
 * The ImageKit <Image> component makes a srcset of 8 URLs for each picture on each render.
 */
export const ProfilePicture: React.FC<Props> = memo(
  ({ playerId, clickToEdit = false, size = 256, border = 0, shape = "circle", linkToPlayer = false }) => {
    const [imageError, setImageError] = useState(false);
    const { timestamp } = useImageKitTimestamp();

    const content =
      imageError || !playerId ? (
        <Fallback playerId={playerId} size={size} />
      ) : (
        <img
          className={classNames(
            "w-full h-full object-cover",
            clickToEdit && " group-hover:opacity-50 transition-opacity duration-150",
          )}
          src={buildSrc({
            urlEndpoint: IMAGE_KIT_URL_ENDPOINT,
            src: playerId,
            transformation: [{ height: imageSize(size), width: imageSize(size) }],
            queryParameters: { v: timestamp },
          })}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      );

    return (
      <div
        className={classNames(
          "overflow-hidden relative group bg-primary-background shrink-0",
          "border-primary-text/50",
          shape === "circle" ? "rounded-full" : "rounded-2xl",
        )}
        style={{ borderWidth: border, borderColor: stringToColor(playerId || "1adagrsss"), height: size, width: size }}
      >
        {linkToPlayer && playerId !== "default" ? (
          <Link aria-disabled to={`/player/${playerId}`} onClick={(e) => e.stopPropagation()}>
            {content}
          </Link>
        ) : clickToEdit ? (
          <Link to={`/camera?player=${playerId}`} className="block w-full h-full">
            {content}
            <div className="absolute text-primary-text py-0.5 rounded-lg bottom-0 text-xs whitespace-nowrap font-thin left-4 transition-opacity duration-150">
              Click to edit
            </div>
          </Link>
        ) : (
          content
        )}
      </div>
    );
  },
);

/** The first letter of the name on the color of the player. Shown when the player has no picture */
const Fallback: React.FC<{ playerId?: string | null; size: number }> = ({ playerId, size }) => {
  const context = useEventDbContext();
  return (
    <div
      className="w-full h-full flex items-center justify-center text-white font-bold select-none"
      style={{
        backgroundColor: stringToColor(playerId || "1adagrsss"),
        fontSize: size * 0.7, // Scale font size relative to component size
      }}
    >
      {playerId ? context.playerName(playerId)[0] : "?"}
    </div>
  );
};
