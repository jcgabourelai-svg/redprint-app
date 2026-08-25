import { useSyncExternalStore } from 'react'
import { SyncManager } from '../lib/sync'

export function useSyncQueue() {
  return useSyncExternalStore(
    SyncManager.subscribe,
    SyncManager.getSnapshot,
    SyncManager.getSnapshot
  )
}
