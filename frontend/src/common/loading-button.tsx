import React from "react";

type LoadingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading: boolean;
  loadingText?: string;
};

/**
 * Button that disables itself and swaps its label for a spinner + loading text
 * while `loading` is true. Styling is passed through `className` so it drops
 * into existing themed buttons.
 */
export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  loadingText = "Saving...",
  disabled,
  children,
  ...buttonProps
}) => {
  return (
    <button {...buttonProps} disabled={disabled || loading}>
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
};
