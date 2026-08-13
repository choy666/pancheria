export type AttemptRecord = {
  count: number;
  lastAttempt: number;
};

export interface RateLimitStore {
  get(username: string): AttemptRecord | undefined;
  set(username: string, record: AttemptRecord): void;
  delete(username: string): void;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private attemptsByUsername = new Map<string, AttemptRecord>();

  get(username: string): AttemptRecord | undefined {
    return this.attemptsByUsername.get(username);
  }

  set(username: string, record: AttemptRecord): void {
    this.attemptsByUsername.set(username, record);
  }

  delete(username: string): void {
    this.attemptsByUsername.delete(username);
  }
}
