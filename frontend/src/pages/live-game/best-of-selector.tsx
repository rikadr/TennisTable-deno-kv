import React from "react";
import { classNames } from "../../common/class-names";

const BEST_OF_OPTIONS = [3, 5, 7];

/** Picks the most sets the match can have. */
export const BestOfSelector: React.FC<{
  value: number;
  onChange: (bestOf: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs uppercase tracking-widest font-bold text-secondary-text">Best of</span>
    <div className="flex gap-1">
      {BEST_OF_OPTIONS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            disabled={disabled}
            aria-pressed={selected}
            className={classNames(
              "min-w-[2.25rem] px-2 py-1 rounded-md text-sm font-bold disabled:opacity-50",
              selected
                ? "bg-tertiary-background text-tertiary-text"
                : "bg-secondary-background text-secondary-text hover:opacity-80",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  </div>
);
