import '@testing-library/jest-dom/vitest'

function ensureLocalStorage() {
  if (typeof globalThis.localStorage?.clear === 'function') return

  const store = new Map()
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: key => store.delete(String(key)),
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
}

ensureLocalStorage()

beforeEach(() => {
  localStorage.clear()
})
