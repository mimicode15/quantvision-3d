// Named timings that show up in the Chrome DevTools Performance panel (Timings track).
// Off unless ?perf is in the URL, so normal visitors pay nothing.

let on = false;

export const setMarks = (enabled: boolean): void => {
  on = enabled;
};

export function timed<T>(name: string, work: () => T): T {
  if (!on) return work();
  const start = performance.now();
  try {
    return work();
  } finally {
    performance.measure(`qv:${name}`, { start, end: performance.now() });
  }
}

/** True when the page was opened with ?perf (before or after the #). */
export function perfRequested(): boolean {
  const { search, hash } = window.location;
  return /(^|[?&])perf(=|&|$)/.test(search) || /[?&]perf(=|&|$)/.test(hash);
}
