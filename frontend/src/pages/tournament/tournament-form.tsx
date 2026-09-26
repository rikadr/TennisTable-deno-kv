import { useState } from "react";
import { classNames } from "../../common/class-names";
import { LoadingButton } from "../../common/loading-button";

export type TournamentFormData = {
  name: string;
  description: string;
  startDate: string; // datetime-local string
  groupPlay: boolean;
  randomGroupSeeding: boolean;
  doubleElimination: boolean;
  overridePreferredGroupSize?: number;
  /** Undefined advances the biggest full power of 2 */
  eliminationThreshold?: number | "none";
};

type EliminationMode = "default" | "custom" | "none";

type TournamentFormProps = {
  initialData?: TournamentFormData;
  onSubmit: (data: TournamentFormData) => void;
  submitLabel: string;
  isPending: boolean;
  /** Fields that are locked and cannot be edited */
  lockedFields?: {
    startDate?: boolean;
    groupPlay?: boolean;
    randomGroupSeeding?: boolean;
    /** Locked when the group play has ended */
    eliminationThreshold?: boolean;
    doubleElimination?: boolean;
  };
};

export const TournamentForm = ({
  initialData,
  onSubmit,
  submitLabel,
  isPending,
  lockedFields,
}: TournamentFormProps) => {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
  const [groupPlay, setGroupPlay] = useState(initialData?.groupPlay ?? false);
  const [randomGroupSeeding, setRandomGroupSeeding] = useState(initialData?.randomGroupSeeding ?? false);
  const [doubleElimination, setDoubleElimination] = useState(initialData?.doubleElimination ?? false);
  const [overrideGroupSize, setOverrideGroupSize] = useState<string>(
    initialData?.overridePreferredGroupSize?.toString() ?? "",
  );
  const initialThreshold = initialData?.eliminationThreshold;
  const [eliminationMode, setEliminationMode] = useState<EliminationMode>(
    initialThreshold === undefined ? "default" : initialThreshold === "none" ? "none" : "custom",
  );
  const [eliminationThreshold, setEliminationThreshold] = useState<string>(
    typeof initialThreshold === "number" ? initialThreshold.toString() : "",
  );
  const [error, setError] = useState<string>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (!name.trim()) {
      setError("Tournament name is required");
      return;
    }
    if (!startDate) {
      setError("Start date is required");
      return;
    }

    const parsedGroupSize = overrideGroupSize ? parseInt(overrideGroupSize, 10) : undefined;
    if (groupPlay && parsedGroupSize !== undefined && parsedGroupSize < 2) {
      setError("Group size must be 2 or higher");
      return;
    }

    let parsedThreshold: number | "none" | undefined;
    if (groupPlay && eliminationMode === "none") parsedThreshold = "none";
    if (groupPlay && eliminationMode === "custom") {
      parsedThreshold = Number(eliminationThreshold);
      if (!eliminationThreshold || !Number.isInteger(parsedThreshold) || parsedThreshold < 2) {
        setError("Elimination threshold must be a whole number of 2 or higher");
        return;
      }
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      startDate,
      groupPlay,
      randomGroupSeeding: groupPlay && randomGroupSeeding,
      doubleElimination,
      overridePreferredGroupSize: groupPlay ? parsedGroupSize : undefined,
      eliminationThreshold: parsedThreshold,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">
          Tournament name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Winter Championship 2026"
          className="w-full px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the tournament..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none resize-y"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">
          Start date *
          {lockedFields?.startDate && (
            <span className="ml-2 text-primary-text/50 normal-case">(locked - tournament has started)</span>
          )}
        </label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={lockedFields?.startDate}
          className={classNames(
            "w-full px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none",
            lockedFields?.startDate && "opacity-50 cursor-not-allowed",
          )}
        />
      </div>

      <div>
        <label
          className={classNames(
            "flex items-center gap-3 cursor-pointer",
            lockedFields?.groupPlay && "opacity-50 cursor-not-allowed",
          )}
        >
          <input
            type="checkbox"
            checked={groupPlay}
            onChange={(e) => setGroupPlay(e.target.checked)}
            disabled={lockedFields?.groupPlay}
            className="w-5 h-5 shrink-0 rounded accent-secondary-background"
          />
          <div>
            <span className="text-xs font-medium text-primary-text/70 uppercase tracking-wide">Group play</span>
            {lockedFields?.groupPlay && (
              <span className="ml-2 text-xs text-primary-text/50">(locked - tournament has started)</span>
            )}
            <p className="text-xs text-primary-text/60 mt-0.5">
              Players are divided into groups for round-robin play before elimination bracket
            </p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">
          Group size override
        </label>
        <input
          type="number"
          min={2}
          value={overrideGroupSize}
          onChange={(e) => setOverrideGroupSize(e.target.value)}
          disabled={!groupPlay}
          placeholder="Default (auto)"
          className={classNames(
            "w-full px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none",
            !groupPlay && "opacity-50 cursor-not-allowed",
          )}
        />
        <p className="text-xs text-primary-text/60 mt-1">
          Override the preferred number of players per group. Leave empty for automatic sizing.
        </p>
      </div>

      <div>
        <label
          className={classNames(
            "flex items-center gap-3 cursor-pointer",
            (!groupPlay || lockedFields?.randomGroupSeeding) && "opacity-50 cursor-not-allowed",
          )}
        >
          <input
            type="checkbox"
            checked={groupPlay && randomGroupSeeding}
            onChange={(e) => setRandomGroupSeeding(e.target.checked)}
            disabled={!groupPlay || lockedFields?.randomGroupSeeding}
            className="w-5 h-5 shrink-0 rounded accent-secondary-background"
          />
          <div>
            <span className="text-xs font-medium text-primary-text/70 uppercase tracking-wide">
              Random group seeding
            </span>
            {lockedFields?.randomGroupSeeding && (
              <span className="ml-2 text-xs text-primary-text/50">(locked - tournament has started)</span>
            )}
            <p className="text-xs text-primary-text/60 mt-0.5">
              A random draw at tournament start divides the players into groups. By default the groups are seeded by
              leaderboard rank, then signup time. The default order still breaks ties in the group scores.
            </p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">
          Elimination threshold
          {lockedFields?.eliminationThreshold && (
            <span className="ml-2 text-primary-text/50 normal-case">(locked - group play has ended)</span>
          )}
        </label>
        <div className="flex gap-2">
          <select
            value={eliminationMode}
            onChange={(e) => setEliminationMode(e.target.value as EliminationMode)}
            disabled={!groupPlay || lockedFields?.eliminationThreshold}
            className={classNames(
              "flex-1 px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none",
              (!groupPlay || lockedFields?.eliminationThreshold) && "opacity-50 cursor-not-allowed",
            )}
          >
            <option value="default">Default (biggest full power of 2)</option>
            <option value="custom">Custom number of players</option>
            <option value="none">No elimination</option>
          </select>
          {eliminationMode === "custom" && (
            <input
              type="number"
              min={2}
              step={1}
              value={eliminationThreshold}
              onChange={(e) => setEliminationThreshold(e.target.value)}
              disabled={!groupPlay || lockedFields?.eliminationThreshold}
              placeholder="Players"
              className={classNames(
                "w-28 px-3 py-2 rounded-lg bg-primary-background text-primary-text ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none",
                (!groupPlay || lockedFields?.eliminationThreshold) && "opacity-50 cursor-not-allowed",
              )}
            />
          )}
        </div>
        <p className="text-xs text-primary-text/60 mt-1">
          The number of players who advance from group play to the elimination bracket. The default is the biggest full
          power of 2, for example 8 of 11 players. With no elimination, all players advance. When fewer players sign up
          than the threshold, all players advance. You can change it until the last group play game is played.
        </p>
      </div>

      <div>
        <label
          className={classNames(
            "flex items-center gap-3 cursor-pointer",
            lockedFields?.doubleElimination && "opacity-50 cursor-not-allowed",
          )}
        >
          <input
            type="checkbox"
            checked={doubleElimination}
            onChange={(e) => setDoubleElimination(e.target.checked)}
            disabled={lockedFields?.doubleElimination}
            className="w-5 h-5 shrink-0 rounded accent-secondary-background"
          />
          <div>
            <span className="text-xs font-medium text-primary-text/70 uppercase tracking-wide">Double elimination</span>
            {lockedFields?.doubleElimination && (
              <span className="ml-2 text-xs text-primary-text/50">(locked - tournament has started)</span>
            )}
            <p className="text-xs text-primary-text/60 mt-0.5">
              Players who lose in the first chance bracket drop into the second chance bracket and can fight their way
              back. The winner of the second chance bracket plays the first chance champion in the final
            </p>
          </div>
        </label>
      </div>

      <LoadingButton
        type="submit"
        loading={isPending}
        loadingText="Saving..."
        className={classNames(
          "w-full py-3 px-6 rounded-lg font-semibold text-secondary-text bg-secondary-background hover:opacity-80 transition-opacity",
          isPending && "opacity-50 cursor-not-allowed",
        )}
      >
        {submitLabel}
      </LoadingButton>
    </form>
  );
};

/** Convert a timestamp to datetime-local input value */
export function timestampToDatetimeLocal(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/** Convert a datetime-local input value to a timestamp */
export function datetimeLocalToTimestamp(datetimeLocal: string): number {
  return new Date(datetimeLocal).getTime();
}
