/**
 * Limitador de concurrencia minimo (sin dependencias externas).
 * Encola tareas y corre a lo sumo `concurrency` a la vez.
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (!run) return;
    active++;
    run();
  }

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

/** Ejecuta `tasks` con concurrencia limitada, tolerando fallos individuales. */
export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<{ item: T; ok: true; value: R } | { item: T; ok: false; error: unknown }>> {
  const limit = createLimiter(concurrency);
  return Promise.all(
    items.map((item) =>
      limit(() => fn(item))
        .then((value) => ({ item, ok: true as const, value }))
        .catch((error) => ({ item, ok: false as const, error })),
    ),
  );
}
