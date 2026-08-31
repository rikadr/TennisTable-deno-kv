import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PhotoCapture } from "./photo-capture";

export const CameraPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const playerId = queryParams.get("player");

  return (
    <div className="flex flex-col gap-4 items-center px-2">
      <h1>Take new profile picture for {context.playerName(playerId)}</h1>
      {playerId ? (
        <PhotoCapture playerId={playerId} onUploaded={() => navigate(`/player/${playerId}`)} />
      ) : (
        <p>No player selected.</p>
      )}
    </div>
  );
};
