/**
 * Mock for electron-store
 * Used in tests to avoid ESM import issues
 */

// Shared storage map to simulate persistence across instances
const sharedStorage = new Map<string, any>()

class MockElectronStore<T extends Record<string, any>> {
  private defaults: T
  private storageKey: string

  constructor(options: { name?: string; cwd?: string; defaults?: T }) {
    this.defaults = options.defaults || ({} as T)
    // Create a unique key based on name and cwd
    this.storageKey = `${options.cwd || 'default'}:${options.name || 'config'}`

    // Initialize storage if it doesn't exist
    if (!sharedStorage.has(this.storageKey)) {
      sharedStorage.set(this.storageKey, { ...this.defaults })
    }
  }

  get store(): T {
    return { ...sharedStorage.get(this.storageKey) }
  }

  set store(value: T) {
    sharedStorage.set(this.storageKey, { ...value })
  }

  get<K extends keyof T>(key: K): T[K] {
    const data = sharedStorage.get(this.storageKey)
    return data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const data = sharedStorage.get(this.storageKey)
    data[key] = value
    sharedStorage.set(this.storageKey, data)
  }

  delete<K extends keyof T>(key: K): void {
    const data = sharedStorage.get(this.storageKey)
    delete data[key]
    sharedStorage.set(this.storageKey, data)
  }

  clear(): void {
    sharedStorage.set(this.storageKey, { ...this.defaults })
  }

  reset(): void {
    sharedStorage.set(this.storageKey, { ...this.defaults })
  }
}

export default MockElectronStore
