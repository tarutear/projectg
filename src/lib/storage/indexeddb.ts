import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Session } from '@/types/session'

interface MotionDB extends DBSchema {
  sessions: {
    key: string
    value: Session
    indexes: { 'by-date': number }
  }
}

let _db: IDBPDatabase<MotionDB> | null = null

async function getDb(): Promise<IDBPDatabase<MotionDB>> {
  if (_db) return _db
  _db = await openDB<MotionDB>('motion-analysis-v1', 1, {
    upgrade(d) {
      const store = d.createObjectStore('sessions', { keyPath: 'id' })
      store.createIndex('by-date', 'startedAt')
    },
  })
  return _db
}

export const saveSession     = async (s: Session)  => (await getDb()).put('sessions', s)
export const loadSession     = async (id: string)  => (await getDb()).get('sessions', id)
export const loadAllSessions = async ()            => (await getDb()).getAllFromIndex('sessions', 'by-date')
export const deleteSession   = async (id: string)  => (await getDb()).delete('sessions', id)
