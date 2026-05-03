import { useCallback, useSyncExternalStore } from "react";

function getServerSnapshot<T>(initialValue: T): () => T {
  return () => initialValue;
}

type SetStateAction<T> = T | ((prev: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetStateAction<T>) => void] {
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
    (newValue: SetStateAction<T>) => {
      try {
        // Read the latest value directly from storage so rapid successive
        // updater calls in the same tick compose correctly — `value` from
        // the render scope may be stale between batched writes.
        const latestRaw = window.localStorage.getItem(key);
        const latest: T =
          latestRaw !== null ? (JSON.parse(latestRaw) as T) : initialValue;
        const resolved =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(latest)
            : newValue;
        window.localStorage.setItem(key, JSON.stringify(resolved));
        // Dispatch a storage event so useSyncExternalStore re-renders
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: JSON.stringify(resolved),
          })
        );
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key, initialValue]
  );

  return [value, setValue];
}
