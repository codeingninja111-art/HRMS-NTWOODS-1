import { useSyncExternalStore } from 'react';

import { getNowTickServerSnapshot, getNowTickSnapshot, subscribeNowTick } from './nowStore';

export function useNowTick({ intervalMs = 1000, enabled = true } = {}) {
  const isEnabled = enabled !== false;
  const subscribe = (cb) => subscribeNowTick(cb, { intervalMs: Number(intervalMs) || 1000 });

  return useSyncExternalStore(
    isEnabled ? subscribe : () => () => {},
    isEnabled ? getNowTickSnapshot : getNowTickServerSnapshot,
    getNowTickServerSnapshot
  );
}
