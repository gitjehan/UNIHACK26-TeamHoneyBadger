import { useEffect, useState } from 'react';

export function useElectronStore<T>(key: string, fallback: T): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let mounted = true;
    window.kinetic
      .storeGet(key)
      .then((stored) => {
        if (!mounted) return;
        if (stored !== undefined && stored !== null) setValue(stored as T);
      })
      .catch((error) => console.warn(`Failed to read store key "${key}"`, error));

    return () => {
      mounted = false;
    };
  }, [key]);

  const setStoreValue = async (nextValue: T) => {
    setValue(nextValue);
    await window.kinetic.storeSet(key, nextValue);
  };

  return [value, setStoreValue];
}
