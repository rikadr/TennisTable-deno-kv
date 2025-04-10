import { useState } from "react";

export function useSessionStorage(key: string, initialValue: string) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? item : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: string) => {
    try {
      setStoredValue(value);
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
