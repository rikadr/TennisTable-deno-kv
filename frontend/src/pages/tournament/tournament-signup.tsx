import { Select } from "@headlessui/react";
import { useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { classNames } from "../../common/class-names";
import { queryClient } from "../../common/query-client";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useEventMutation } from "../../hooks/use-event-mutation";
import {
  EventTypeEnum,
  TournamentCancelSignup,
  TournamentSignup as TournamentSignupType,
} from "../../client/client-db/event-store/event-types";

export const TournamentSignup: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const [signUpEdit, setSignUpEdit] = useState(false);
  const [signUpPlayer, setSignUpPlayer] = useState<string>();
  const [showConfetti, setShowConfetti] = useState(false);

  function submitSignup(player: string) {
    const now = Date.now();
    const event: TournamentSignupType = {
      type: EventTypeEnum.TOURNAMENT_SIGNUP,
      time: now,
      stream: tournament.id,
      data: { player },
    };
    const validateResponse = context.eventStore.tournamentsProjector.validateSignup(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }
    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setShowConfetti(true);
        setSignUpPlayer(undefined);
        setSignUpEdit(false);
      },
    });
  }

  function submitCancelSignup(player: string) {
    const now = Date.now();
    const event: TournamentCancelSignup = {
      type: EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP,
      time: now,
      stream: tournament.id,
      data: { player },
    };
    const validateResponse = context.eventStore.tournamentsProjector.validateCancelSignup(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }
    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    });
  }

  return (
    <div className="m-auto space-y-4 max-w-96 flex flex-col items-center w-full">
      <button
        className={classNames(
          "text-lg font-semibold w-full py-4 px-6 flex flex-col items-center bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-lg",
        )}
        onClick={() => setSignUpEdit(true)}
      >
        <h2 className="flex gap-2">
          <div>{signUpEdit ? "↓ Choose player ↓" : "Sign up here! ✍️🏆"}</div>
        </h2>
        {showConfetti && <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />}
      </button>
      {signUpEdit && (
        <Select
          value={signUpPlayer}
          onChange={(e) => {
            setSignUpPlayer(e.target.value);
            setShowConfetti(false);
          }}
          className="text-lg font-semibold w-full py-4 px-6 flex flex-col items-center ring ring-secondary-background bg-primary-background hover:bg-secondary-background/70 text-primary-text rounded-lg"
        >
          {!signUpPlayer && (
            <option key="No selected" className="text-cener w-full">
              Select player to sign up...
            </option>
          )}
          {context.players
            .filter((p) => !tournament.signedUp.some((s) => s.player === p.name))
            .map((player) => (
              <option value={player.id} key={player.name}>
                {player.name}
              </option>
            ))}
        </Select>
      )}
      {signUpPlayer && (
        <button
          className={classNames(
            "text-lg font-semibold w-full py-4 px-6 flex flex-col items-center bg-tertiary-background hover:bg-tertiary-background/70 text-tertiary-text rounded-lg",
          )}
          onClick={() => (signUpPlayer ? submitSignup(signUpPlayer) : setSignUpEdit(true))}
        >
          <h2 className="flex gap-2">
            <div>Sign up {context.playerName(signUpPlayer)} </div>
            <div className={classNames(addEventMutation.isPending && "animate-spin")}>✍️🏆</div>
          </h2>
          {showConfetti && <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />}
        </button>
      )}
      <div className="ring-1 ring-secondary-background w-full px-4 md:px-6 py-2 rounded-lg divide-y divide-primary-text/50">
        <h1 className="mb-4">
          Signed up players{" "}
          <span className="pl-1 font-thin italic text-base text-primary-text">({tournament.signedUp.length})</span>
        </h1>
        {tournament.signedUp.map((p) => {
          const playerName = context.playerName(p.player);
          return (
            <div key={p.player} className="flex justify-between items-center h-10 gap-4">
              <div className="flex gap-2 items-center">
                <ProfilePicture playerId={p.player} size={25} border={2} linkToPlayer />
                <p className="text-lg">{playerName}</p>
              </div>
              <button
                className="italic text-primary-text/ font-thin text-xs"
                onClick={() =>
                  window.confirm(`Are you sure you want to withdraw ${playerName} from the tournament?`) &&
                  submitCancelSignup(p.player)
                }
              >
                (Remove)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
