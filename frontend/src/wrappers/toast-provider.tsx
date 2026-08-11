import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { classNames } from "../common/class-names";

export type ToastVariant = "error" | "success";

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type ToastContextType = {
  showToast: (variant: ToastVariant, message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const TOAST_DURATION_MS = 6_000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextIdRef.current++;
      setToasts((current) => [...current, { id, variant, message }]);
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="alert"
              className={classNames(
                "pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg",
                "bg-secondary-background text-secondary-text border-l-4",
                toast.variant === "error" ? "border-red-500" : "border-green-500",
              )}
            >
              <span aria-hidden="true">{toast.variant === "error" ? "⚠️" : "✅"}</span>
              <p className="flex-1 text-sm break-words">{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss"
                className="shrink-0 px-1 opacity-70 hover:opacity-100"
                onClick={() => dismissToast(toast.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};
