import { Link, useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";
import { IKImage } from "imagekitio-react";
import { useImageKitTimestamp } from "../../wrappers/image-kit-context";
import { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId?: string | null;
  size?: number;
  clickToEdit?: boolean;
  border?: number;
  shape?: "circle" | "rounded";
  linkToPlayer?: boolean;
};

export const ProfilePicture: React.FC<Props> = ({
  playerId,
  clickToEdit = false,
  size = 256,
  border = 0,
  shape = "circle",
  linkToPlayer = false,
}) => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const { timestamp } = useImageKitTimestamp();
  const HighDefinitionScaleFactor = 4;

  const img = () => (
    <IKImage
      className={classNames(
        "w-full h-full object-cover",
        clickToEdit && " group-hover:opacity-50 transition-opacity duration-150",
      )}
      path={playerId ?? ""}
      transformation={[{ height: size * HighDefinitionScaleFactor, width: size * HighDefinitionScaleFactor }]}
      queryParameters={{ v: timestamp }}
      onError={() => setImageError(true)}
    />
  );
  const fallback = () => (
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

  const content = () => (imageError || !playerId ? fallback() : img());

  return (
    <div
      className={classNames(
        "overflow-hidden relative group bg-primary-background shrink-0",
        "border-primary-text/50",
        clickToEdit && "cursor-pointer",
        shape === "circle" ? "rounded-full" : "rounded-2xl",
      )}
      style={{ borderWidth: border, borderColor: stringToColor(playerId || "1adagrsss"), height: size, width: size }}
      onClick={() => clickToEdit && navigate(`/camera?player=${playerId}`)}
    >
      {clickToEdit && (
        <div className="absolute text-primary-text py-0.5 rounded-lg bottom-0 text-xs whitespace-nowrap font-thin left-4 transition-opacity duration-150">
          Click to edit
        </div>
      )}
      {linkToPlayer && playerId !== "default" ? (
        <Link aria-disabled to={`/player/${playerId}`} onClick={(e) => e.stopPropagation()}>
          {content()}
        </Link>
      ) : (
        content()
      )}
    </div>
  );
};
