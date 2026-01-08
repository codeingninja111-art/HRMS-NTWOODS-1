let nowMs = Date.now();
let timerId = null;
let activeIntervalMs = 1000;

const listeners = new Set();
const listenerIntervalMs = new Map();

function tick() {
  nowMs = Date.now();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

function computeMinIntervalMs() {
  let min = 1000;
  listenerIntervalMs.forEach((ms) => {
    const v = Number(ms) || 1000;
    if (v > 0 && v < min) min = v;
  });
  return min;
}

function ensureTimer() {
  if (timerId != null) return;
  timerId = setInterval(tick, activeIntervalMs);
}

function stopTimer() {
  if (timerId == null) return;
  clearInterval(timerId);
  timerId = null;
}

function reconcileTimer() {
  if (listeners.size === 0) {
    stopTimer();
    return;
  }
  const next = computeMinIntervalMs();
  if (timerId == null) {
    activeIntervalMs = next;
    ensureTimer();
    return;
  }
  if (next !== activeIntervalMs) {
    activeIntervalMs = next;
    stopTimer();
    ensureTimer();
  }
}

export function subscribeNowTick(onStoreChange, { intervalMs = 1000 } = {}) {
  if (typeof onStoreChange !== 'function') return () => {};
  listeners.add(onStoreChange);
  listenerIntervalMs.set(onStoreChange, Number(intervalMs) || 1000);
  reconcileTimer();
  return () => {
    listeners.delete(onStoreChange);
    listenerIntervalMs.delete(onStoreChange);
    reconcileTimer();
  };
}

export function getNowTickSnapshot() {
  return nowMs;
}

export function getNowTickServerSnapshot() {
  return Date.now();
}

