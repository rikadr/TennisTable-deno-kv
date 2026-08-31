import { classNames } from "./class-names";

/**
 * The bar at the bottom of a stepped flow, and the 2 buttons that go in it.
 * The add game flow and the new player flow share the look, so they share
 * these and cannot drift apart.
 */
export const StepFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 bg-secondary-background shrink-0">
    <div className="flex space-x-3">{children}</div>
  </div>
);

export const StepBackButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-primary-text flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/80 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
  >
    <span>← Back</span>
  </button>
);

/** The button that goes to the next step, or submits on the last step. */
export const StepForwardButton: React.FC<{
  onClick?: () => void;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={classNames(
      "flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors ring-1 ring-primary-background",
      disabled
        ? "bg-tertiary-background/50 text-tertiary-text/50 cursor-not-allowed"
        : "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75",
    )}
  >
    {children}
  </button>
);
