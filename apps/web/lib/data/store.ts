/** State the instance keeps itself, read and changed as one value. */
export interface StateStore<T> {
  /** Reads, changes and writes the contents as one step. */
  update<R>(change: (contents: T) => R): R;
  read(): T;
}

/** The same interface in memory, for tests. */
export function memoryStore<T>(contents: T): StateStore<T> {
  let state = contents;
  return {
    read: () => structuredClone(state),
    update(change) {
      const next = structuredClone(state);
      const result = change(next);
      state = next;
      return result;
    },
  };
}
