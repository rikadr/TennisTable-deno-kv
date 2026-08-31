import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { PhotoCapture } from "./photo-capture";

export const CameraPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const location = useLocation();
  const playerId = new URLSearchParams(location.search).get("player");

  if (!playerId) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-primary-text">
        <h1 className="text-xl font-bold">No player selected</h1>
        <p className="mt-2 text-sm text-primary-text/70">Open the page of a player, and select the picture there.</p>
        <Link
          to="/leaderboard"
          className="mt-6 inline-block rounded-xl bg-tertiary-background px-4 py-3 font-semibold text-tertiary-text"
        >
          Go to the leaderboard
        </Link>
      </div>
    );
  }

  return (
    // A fixed column from the bottom edge of the nav, so the buttons stay on
    // the screen of a phone and the page never scrolls sideways.
    <div className="fixed inset-x-0 bottom-0 top-16 flex flex-col px-3 pb-3 md:top-12">
      <div className="flex shrink-0 items-center gap-3 py-3">
        <ProfilePicture playerId={playerId} size={40} shape="circle" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-primary-text">New photo of {context.playerName(playerId)}</h1>
          <button
            type="button"
            className="text-sm text-primary-text/60 underline hover:text-primary-text"
            onClick={() => navigate(`/player/${playerId}`)}
          >
            Cancel and go back
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
        <PhotoCapture playerId={playerId} onUploaded={() => navigate(`/player/${playerId}`)} />
      </div>
    </div>
  );
};
