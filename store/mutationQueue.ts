/** Serialize whole mutations while allowing later operations after a failure. */
export function createMutationQueue() {
  let pending: Promise<void> = Promise.resolve();
  return function serialize<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
    return (...args: Args): Promise<Result> => {
      const result = pending.then(() => action(...args));
      pending = result.then(() => {}, () => {});
      return result;
    };
  };
}
