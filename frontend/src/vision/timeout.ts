/** Rejects with `error` if `promise` takes longer than `ms`. The timer is always cleaned up. */
export function withTimeout<T>(promise: Promise<T>, ms: number, error: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(error()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
