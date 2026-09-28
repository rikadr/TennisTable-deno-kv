import { classNames } from "./class-names";

/**
 * The bar at the bottom of a stepped flow, and the 2 buttons that go in it.
 * The add game flow and the new player flow share the look, so they share
 * these and cannot drift apart.
 *
 * The buttons use fixed colors, not theme colors. Some themes made the
 * forward button look disabled, or gave the back button more focus.
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
    className="flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors bg-white text-gray-800 ring-1 ring-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
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
      "flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors",
      disabled
        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
        : "bg-gradient-to-b from-green-400 to-green-600 text-white shadow-md ring-2 ring-white hover:from-green-500 hover:to-green-700",
    )}
  >
    {children}
  </button>
);
