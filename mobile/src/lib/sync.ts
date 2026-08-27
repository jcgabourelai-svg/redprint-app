import axios from 'axios'
import api, { apiErrorMessage, isNetworkError } from './api'
import { deleteItem, getAllQueue, putItem } from './db'
import type { QueueItem, ReadingPayload, FieldRecordPayload } from './db'

export const SYNC_DONE_EVENT = 'redprint:sync-done'

export interface SyncSnapshot {
  items: QueueItem[]
  syncing: boolean
}

const listeners = new Set<() => void>()
let snapshot: SyncSnapshot = { items: [], syncing: false }
let started = false

function emit() {
  listeners.forEach((l) => l())
}

async function refresh() {
  try {
    const items = await getAllQueue()
    snapshot = { ...snapshot, items }
    emit()
  } catch {
    snapshot = { ...snapshot, items: [] }
    emit()
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isPermanentError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const status = err.response?.status
  if (status === undefined) return false
  if (status === 401 || status === 429) return false
  return status >= 400 && status < 500
}

export const SyncManager = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): SyncSnapshot {
    return snapshot
  },

  async enqueueReading(payload: ReadingPayload): Promise<void> {
    const item: QueueItem = {
      id: uuid(),
      type: 'reading',
      payload,
      created_at: new Date().toISOString(),
      estado: 'pendiente',
    }
    await putItem(item)
    await refresh()
    void this.sync()
  },

  async enqueueFieldRecord(payload: FieldRecordPayload): Promise<void> {
    const item: QueueItem = {
      id: uuid(),
      type: 'field_record',
      payload,
      created_at: new Date().toISOString(),
      estado: 'pendiente',
    }
    await putItem(item)
    await refresh()
    void this.sync()
  },

  async discard(id: string): Promise<void> {
    await deleteItem(id)
    await refresh()
  },

  async retry(id: string): Promise<void> {
    const item = snapshot.items.find((i) => i.id === id)
    if (!item) return
    await putItem({ ...item, estado: 'pendiente', error_msg: undefined })
    await refresh()
    void this.sync()
  },

  findQueued(visitaId: number, impresoraId: number): QueueItem | undefined {
    return snapshot.items.find(
      (i) =>
        i.type === 'reading' &&
        i.payload.visita_id === visitaId &&
        i.payload.impresora_id === impresoraId
    )
  },

  async sync(): Promise<void> {
    if (snapshot.syncing || !navigator.onLine) return
    snapshot = { ...snapshot, syncing: true }
    emit()
    try {
      for (;;) {
        const items = await getAllQueue()
        const item = items.find((i) => i.estado === 'pendiente')
        if (!item) break
        try {
          // Dispatch por tipo de item: cada entidad tiene su endpoint.
          // El dedup de field_record lo hace el server por client_uuid.
          if (item.type === 'reading') {
            await api.post('/readings', item.payload)
          } else {
            await api.post('/field-records', item.payload)
          }
          await deleteItem(item.id)
        } catch (err) {
          if (isNetworkError(err)) break
          if (isPermanentError(err)) {
            await putItem({ ...item, estado: 'error', error_msg: apiErrorMessage(err) })
          } else {
            break
          }
        }
      }
      window.dispatchEvent(new CustomEvent(SYNC_DONE_EVENT))
    } finally {
      snapshot = { ...snapshot, syncing: false }
      await refresh()
    }
  },

  async start(): Promise<void> {
    if (started) return
    started = true
    window.addEventListener('online', () => {
      void SyncManager.sync()
    })
    await refresh()
    void this.sync()
  },
}
