// Saves live in localStorage under one key. Format versions are handled by Game.fromJSON.
export class SaveStore {
  constructor(key = 'hotel-tycoon-save-v1', storage = null) {
    this.key = key
    this.injected = storage
  }

  // looked up per call: storage can appear after this module loads (tests) or be blocked
  get storage() {
    try {
      return this.injected ?? globalThis.localStorage
    } catch {
      return null
    }
  }

  read() {
    try {
      const raw = this.storage?.getItem(this.key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  write(game) {
    try {
      this.storage?.setItem(this.key, JSON.stringify(game))
    } catch { /* storage full or unavailable */ }
  }

  clear() {
    try { this.storage?.removeItem(this.key) } catch { /* ignore */ }
  }
}
