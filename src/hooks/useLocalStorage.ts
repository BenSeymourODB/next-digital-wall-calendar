import { useCallback, useSyncExternalStore } from "react";

function getServerSnapshot<T>(initialValue: T): () => T {
  return () => initialValue;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  // Subscribe to storage events so the hook re-renders when another tab writes
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ?? null;
    } catch {
      return null;
    }
  }, [key]);

  // useSyncExternalStore handles hydration: server returns null,
  // client reads localStorage — React reconciles without mismatch.
  const raw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot(null)
  );

  const value: T = raw !== null ? JSON.parse(raw) : initialValue;

  const setValue = useCallback(
    (newValue: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
        // Dispatch a storage event so useSyncExternalStore re-renders
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: JSON.stringify(newValue),
          })
        );
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key]
  );

  return [value, setValue];
}
