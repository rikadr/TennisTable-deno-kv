import { Link, useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../compare-players-page";
import { useClientDbContext } from "../../wrappers/client-db-context";

type Props = {
  name?: string;
  size?: number;
  clickToEdit?: boolean;
  border?: number;
  shape?: "circle" | "rounded";
  linkToPlayer?: boolean;
};

export const ProfilePicture: React.FC<Props> = ({
  name = "default",
  clickToEdit = false,
  size = 256,
  border = 0,
  shape = "circle",
  linkToPlayer = false,
}) => {
  const navigate = useNavigate();
  const { players, defaultProfilePhoto } = useClientDbContext();

  let profilePhoto: string | undefined = undefined;
  const player = players.find((p) => p.name === name);
  if (player) {
    // So it only fetches backend for photo if player is not among the registered players
    profilePhoto = player.photo ?? defaultProfilePhoto;
  }

  const img = () => (
    <img
      className={classNames(
        "w-full h-full object-cover",
        clickToEdit && " group-hover:opacity-50 transition-opacity duration-150",
      )}
      src={profilePhoto || `${process.env.REACT_APP_API_BASE_URL}/player/${name}/profile-picture`}
      alt="Profile"
    />
  );
  return (
    <div
      className={classNames(
        "overflow-hidden relative group bg-primary-background shrink-0",
        "border-primary-text/50",
        clickToEdit && "cursor-pointer",
        shape === "circle" ? "rounded-full" : "rounded-2xl",
      )}
      style={{ borderWidth: border, borderColor: stringToColor(name || "1adagrsss"), height: size, width: size }}
      onClick={() => clickToEdit && navigate(`/camera?player=${name}`)}
    >
      {clickToEdit && (
        <div className="absolute text-primary-text bg-primary-background/30 px-3 py-0.5 rounded-lg bottom-0 text-sm font-thin left-1/2 transform -translate-x-1/2 transition-opacity duration-150">
          Click to edit
        </div>
      )}
      {linkToPlayer && name !== "default" ? (
        <Link aria-disabled to={`/player/${name}`}>
          {img()}
        </Link>
      ) : (
        img()
      )}
    </div>
  );
};
