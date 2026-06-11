import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Session } from '@/types/session'

interface MotionDB extends DBSchema {
  sessions: {
    key: string
    value: Session
    indexes: { 'by-date': number }
  }
}

// Promise singleton prevents multiple concurrent openDB calls racing each other
let _dbPromise: Promise<IDBPDatabase<MotionDB>> | null = null

function getDb(): Promise<IDBPDatabase<MotionDB>> {
  if (!_dbPromise) {
    _dbPromise = openDB<MotionDB>('motion-analysis-v1', 1, {
      upgrade(d) {
        const store = d.createObjectStore('sessions', { keyPath: 'id' })
        store.createIndex('by-date', 'startedAt')
      },
    }).catch((err) => {
      _dbPromise = null // allow retry after transient failures
      throw err
    })
  }
  return _dbPromise
}

export async function saveSession(s: Session): Promise<void> {
  try {
    await (await getDb()).put('sessions', s)
  } catch (err) {
    console.error('[IDB] saveSession failed:', err)
    throw err
  }
}

export async function loadSession(id: string): Promise<Session | undefined> {
  try {
    return await (await getDb()).get('sessions', id)
  } catch (err) {
    console.error('[IDB] loadSession failed:', err)
    return undefined
  }
}

export async function loadAllSessions(): Promise<Session[]> {
  try {
    return await (await getDb()).getAllFromIndex('sessions', 'by-date')
  } catch (err) {
    console.error('[IDB] loadAllSessions failed:', err)
    return []
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await (await getDb()).delete('sessions', id)
  } catch (err) {
    console.error('[IDB] deleteSession failed:', err)
    throw err
  }
}
