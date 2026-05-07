import { useSyncExternalStore } from "react";

function getServerSnapshot<T>(initialValue: T): () => T {
  return () => initialValue;
}

type SetStateAction<T> = T | ((prev: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetStateAction<T>) => void] {
  // Subscribe to storage events so the hook re-renders when another tab writes.
  //
  // `useSyncExternalStore` requires `subscribe` and `getSnapshot` to be
  // referentially stable across renders — if `subscribe` changes, React
  // re-subscribes, and if `getSnapshot` changes it forces a re-read. Under
  // CLAUDE.md's no-manual-memoization rule (#271) we drop `useCallback`,
  // so stability is provided by the React Compiler instead: it memoizes
  // these inline functions based on their captured deps, and
  // `babel-plugin-react-compiler` is wired into both `next.config.ts` and
  // `vitest.config.ts` so production and tests see the same behaviour.
  // Today the only captured dep is `key`, which is always a stable
  // string in callers; if a future caller passes a per-render-changing
  // string here, RC will correctly create a fresh subscribe function and
  // `useSyncExternalStore` will re-subscribe — which is the desired
  // behaviour, not a bug.
  const subscribe = (onStoreChange: () => void) => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) onStoreChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  };

  const getSnapshot = () => {
    try {
      const item = window.localStorage.getItem(key);
      return item ?? null;
    } catch {
      return null;
    }
  };

  // useSyncExternalStore handles hydration: server returns null,
  // client reads localStorage — React reconciles without mismatch.
  const raw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot(null)
  );

  const value: T = raw !== null ? JSON.parse(raw) : initialValue;

  const setValue = (newValue: SetStateAction<T>) => {
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
  };

  return [value, setValue];
}
