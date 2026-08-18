import React from "react";
import { classNames } from "./class-names";

/**
 * Labeled pill selector in the style of the tournament tree/list toggle,
 * generalized to any number of options: a knob slides to the selected one.
 */
export function PillSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs md:text-sm text-primary-text/60">{label}</span>
      <div
        className={classNames(
          "relative flex h-10 rounded-full bg-secondary-background p-1",
          // More options need more room than two, so the texts keep some
          // space between each other and to the ends of the pill.
          options.length > 4 ? "w-full max-w-xs" : options.length > 2 ? "w-52" : "w-40",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary-background shadow-lg transition-transform duration-200 ease-in-out"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={classNames(
              "z-10 flex-1 flex items-center justify-center px-2 text-xs xs:text-sm whitespace-nowrap rounded-full focus:outline-none",
              option.value === value ? "text-primary-text" : "text-secondary-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
