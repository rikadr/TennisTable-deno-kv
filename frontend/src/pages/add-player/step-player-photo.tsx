import { useState } from "react";
import { classNames } from "../../common/class-names";
import { PhotoCapture } from "../camera/photo-capture";
import { PlayerColorPreview } from "./player-color-preview";

export const StepPlayerPhoto: React.FC<{
  playerName: string;
  playerId: string;
  onUploaded: () => void;
  onSkip: () => void;
}> = ({ playerName, playerId, onUploaded, onSkip }) => {
  const [capturePhoto, setCapturePhoto] = useState(false);

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div className="flex flex-col items-center gap-3 text-center">
        <PlayerColorPreview playerId={playerId} playerName={playerName} size={112} />
        <h2 className="text-xl font-bold text-primary-text">{playerName} is on the leaderboard 🎉</h2>
      </div>

      <div className="rounded-lg bg-secondary-background text-secondary-text px-4 py-3 space-y-2">
        <p className="font-semibold">1 step remains: the photo of {playerName}</p>
        <p className="text-sm">
          The photo shows next to the name of {playerName} on the leaderboard, in the games and in the tournaments. It
          takes 10 seconds, and you can change the photo at any time.
        </p>
      </div>

      {capturePhoto ? (
        <div className="space-y-4">
          <PhotoCapture playerId={playerId} onUploaded={onUploaded} />
          <button
            type="button"
            className="w-full py-3 px-4 rounded-xl font-medium text-primary-text bg-primary-background hover:bg-primary-background/80 ring-1 ring-secondary-background transition-colors"
            onClick={onSkip}
          >
            Add the photo later
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            className={classNames(
              "w-full py-4 px-4 rounded-xl text-lg font-semibold transition-colors",
              "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75",
            )}
            onClick={() => setCapturePhoto(true)}
          >
            📸 Take the photo now
          </button>
          <button
            type="button"
            className="w-full py-3 px-4 rounded-xl font-medium text-primary-text bg-primary-background hover:bg-primary-background/80 ring-1 ring-secondary-background transition-colors"
            onClick={onSkip}
          >
            Add the photo later
          </button>
        </div>
      )}
    </div>
  );
};
