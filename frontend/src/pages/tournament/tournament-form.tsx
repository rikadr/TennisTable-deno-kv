import { useState } from "react";
import { classNames } from "../../common/class-names";

export type TournamentFormData = {
  name: string;
  description: string;
  startDate: string; // datetime-local string
  groupPlay: boolean;
};

type TournamentFormProps = {
  initialData?: TournamentFormData;
  onSubmit: (data: TournamentFormData) => void;
  submitLabel: string;
  isPending: boolean;
  /** Fields that are locked and cannot be edited */
  lockedFields?: { startDate?: boolean; groupPlay?: boolean };
};

export const TournamentForm = ({ initialData, onSubmit, submitLabel, isPending, lockedFields }: TournamentFormProps) => {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
  const [groupPlay, setGroupPlay] = useState(initialData?.groupPlay ?? false);
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

    onSubmit({ name: name.trim(), description: description.trim(), startDate, groupPlay });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
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
            className="w-5 h-5 rounded accent-secondary-background"
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

      <button
        type="submit"
        disabled={isPending}
        className={classNames(
          "w-full py-3 px-6 rounded-lg font-semibold text-secondary-text bg-secondary-background hover:opacity-80 transition-opacity",
          isPending && "opacity-50 cursor-not-allowed",
        )}
      >
        {isPending ? "Saving..." : submitLabel}
      </button>
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
