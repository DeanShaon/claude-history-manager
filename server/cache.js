class Cache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 30000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear() {
    this.store.clear();
  }

  getOrSet(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = factory();
    this.set(key, value, ttlMs);
    return value;
  }

  async getOrSetAsync(key, ttlMs, factory) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

module.exports = new Cache();
