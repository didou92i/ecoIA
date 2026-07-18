export class WriteQueue {
  private readonly pendingByKey = new Map<string, Promise<unknown>>();

  enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pendingByKey.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.pendingByKey.set(key, current);
    return current.finally(() => {
      if (this.pendingByKey.get(key) === current) this.pendingByKey.delete(key);
    });
  }
}
