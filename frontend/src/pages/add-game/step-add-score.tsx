import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { classNames } from "../../common/class-names";

export const StepAddScore: React.FC<{
  player1: { id: string; sets: number; setSets: (sets: number) => void };
  player2: { id: string; sets: number; setSets: (sets: number) => void };
  setPoints: {
    setPoints: { player1?: number; player2?: number }[];
    setSetPoints: React.Dispatch<React.SetStateAction<{ player1?: number; player2?: number }[]>>;
  };
  winner: string;
  invalidScore: boolean;
}> = ({ player1, player2, setPoints, winner, invalidScore }) => {
  return (
    <div className="space-y-2 max-w-2xl m-auto">
      <WinnerBox winner={winner} orientation={winner === player1.id ? "left" : "right"} />
      <div className="p-4 bg-secondary-background text-secondary-text rounded-xl">
        <h2 className="text-center text-2xl">Sets won</h2>
        <p className="text-center">(Optional)</p>
        <div
          className={classNames("flex justify-evenly gap-2", player1.sets === 0 && player2.sets === 0 && "opacity-50")}
        >
          <SetCounter player={player1} />
          <SetCounter player={player2} />
        </div>
        {invalidScore && (
          <p className="bg-white text-red-500 text-center mt-4">
            Invalid score. Winner must have won more sets than the loser
          </p>
        )}
      </div>
      <SetPoints player1={player1.id} player2={player2.id} setPoints={setPoints} />
    </div>
  );
};

const SetPointsInput: React.FC<{
  playerId: string;
  setIndex: number;
  playerIndex: "player1" | "player2";
  setPoints: {
    setPoints: { player1?: number; player2?: number }[];
    setSetPoints: React.Dispatch<React.SetStateAction<{ player1?: number; player2?: number }[]>>;
  };
}> = ({ playerId, setIndex, playerIndex, setPoints: { setPoints, setSetPoints } }) => {
  const context = useEventDbContext();
  const currentPoints = setPoints[setIndex][playerIndex];

  function handleUpdatePoints(input: number | string) {
    let value: number | undefined = undefined;

    if (input !== "") {
      value = Math.max(typeof input === "string" ? parseInt(input) : input, 0);
    }

    const newPoints = [...setPoints];
    newPoints[setIndex] = { ...newPoints[setIndex], [playerIndex]: value };
    setSetPoints(newPoints);
  }
  return (
    <div className="-mt-2">
      <label className="block text-sm mb-1 text-center">{context.playerName(playerId)}</label>
      <div className="flex">
        <input
          type="number"
          placeholder="0"
          className="w-24 h-12 pl-3 ring-[2px] ring-white bg-white text-black text-center text-3xl font-semibold rounded-md"
          value={currentPoints}
          onChange={(e) => handleUpdatePoints(e.target.value)}
        />
      </div>
    </div>
  );
};
const SetPoints: React.FC<{
  player1: string;
  player2: string;
  setPoints: {
    setPoints: { player1?: number; player2?: number }[];
    setSetPoints: React.Dispatch<React.SetStateAction<{ player1?: number; player2?: number }[]>>;
  };
}> = ({ player1, player2, setPoints }) => {
  const anyPointsSet = setPoints.setPoints.some((set) => set.player1 !== undefined || set.player2 !== undefined);

  return (
    <div className="text-primary-text">
      <div className="grid grid-cols-1 gap-2">
        {setPoints.setPoints.map((_, index) => (
          <div
            key={index}
            className={classNames(
              "bg-secondary-background text-secondary-text rounded-lg px-4 py-2",
              anyPointsSet === false && "opacity-50",
            )}
          >
            {index === 0 && (
              <>
                <h2 className="text-center text-xl">Individual points pr. set</h2>
                <p className="text-center mb-6">(Optional)</p>
              </>
            )}
            <div className="flex flex-row items-start justify-evenly h-16 max-w-96 m-auto">
              <h4 className="font-medium">Set {index + 1}</h4>
              <SetPointsInput playerId={player1} playerIndex="player1" setIndex={index} setPoints={setPoints} />
              <span className="text-2xl font-bold text-secondary-text mt-5">-</span>
              <SetPointsInput playerId={player2} playerIndex="player2" setIndex={index} setPoints={setPoints} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SetCounter: React.FC<{
  player: { id: string; sets: number; setSets: (sets: number) => void };
}> = ({ player: { id, sets, setSets } }) => {
  const context = useEventDbContext();
  return (
    <div className="flex flex-col items-center">
      <h2>{context.playerName(id)}</h2>
      <div className="flex items-center gap-1">
        <button
          className="w-12 aspect-square rounded-full bg-primary-background text-primary-text hover:bg-primary-background/75 "
          onClick={() => setSets(Math.max(sets - 1, 0))}
        >
          &#8722;
        </button>
        <div
          className="w-24 aspect-square rounded-full flex items-center justify-center bg-primary-background text-primary-text text-4xl"
          style={{ borderWidth: 12, borderColor: stringToColor(id || "1adagrsss") }}
        >
          {sets}
        </div>
        <button
          className="w-12 aspect-square rounded-full bg-primary-background text-primary-text hover:bg-primary-background/75 "
          onClick={() => setSets(sets + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
};

const WinnerBox: React.FC<{
  winner: string;
  orientation: "left" | "right";
}> = ({ winner, orientation }) => {
  const context = useEventDbContext();
  return (
    <div
      className={classNames(
        "relative py-3 px-6 flex justify-between items-center bg-secondary-background rounded-xl",
        orientation === "right" && "flex-row-reverse",
      )}
    >
      <div className={classNames("flex gap-2 items-center", orientation === "right" && "flex-row-reverse")}>
        <ProfilePicture playerId={winner} border={3} size={60} />
        <p className="text-4xl text-center w-[60px]">🏆</p>
      </div>
      <div className="absolute inset-0 m-auto text-secondary-text flex flex-col justify-center">
        <p className="text-center">Winner</p>
        <h2 className="text-center text-2xl">{context.playerName(winner)}</h2>
      </div>
    </div>
  );
};
