// ── Staying logged in, on this device ([auth]) ─────────────────────────────
//
// "Make sure login persists across closing the app."
//
// ⚠️ NOT THE SAME STORE AS gameStore. A game in progress is per tab; who you are is not. This is
// always localStorage, which on an iPhone home-screen app survives the app being closed and relaunched
// (the seven-day limit Safari applies to websites does not apply to a home-screen app).
//
// IndexedDB holds a second copy, because iOS may clear one under storage pressure and rarely both, and
// the page asks the browser to treat its storage as persistent. Signing out is the one thing that
// clears them. In particular a network failure never does: being offline is not being signed out.

export interface AuthUser { id: string; email?: string | null; name: string; picture?: string | null }
export interface AuthRecord { token: string; user: AuthUser }

const KEY = 'ef2_auth'
const DB = 'ef2'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGet(): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(value: string | null): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      if (value == null) tx.objectStore(STORE).delete(KEY)
      else tx.objectStore(STORE).put(value, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

function parse(raw: string | null): AuthRecord | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return typeof v?.token === 'string' && v.user ? v : null
  } catch {
    return null
  }
}

// What is held right now, synchronously. loadAuth also checks the second copy.
export function peekAuth(): AuthRecord | null {
  try { return parse(localStorage.getItem(KEY)) } catch { return null }
}

export async function loadAuth(): Promise<AuthRecord | null> {
  const local = peekAuth()
  if (local) {
    void idbSet(JSON.stringify(local))
    return local
  }
  // The first copy is gone. If the second is not, put the first back and carry on signed in.
  const backup = parse(await idbGet())
  if (backup) {
    try { localStorage.setItem(KEY, JSON.stringify(backup)) } catch { /* the backup still works */ }
  }
  return backup
}

export function saveAuth(record: AuthRecord): void {
  const raw = JSON.stringify(record)
  try { localStorage.setItem(KEY, raw) } catch { /* the IndexedDB copy still works */ }
  void idbSet(raw)
  void navigator.storage?.persist?.().catch(() => {})
}

export function clearAuth(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing more to do */ }
  void idbSet(null)
}

// ── The game a season is in the middle of ────────────────────────────────
//
// Set when a game starts and cleared when it is saved and quit or finished. On launch, or when the
// connection comes back to find the server has restarted, this is what says "there is a game to get
// back to" and it survives the app being closed.

const ACTIVE_KEY = 'ef2_active_season'

export function getActiveSeason(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}

export function setActiveSeason(seasonId: string | null): void {
  try {
    if (seasonId) localStorage.setItem(ACTIVE_KEY, seasonId)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch { /* the save-slot screen still offers Resume */ }
}
