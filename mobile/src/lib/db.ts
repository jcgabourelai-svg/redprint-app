export interface ReadingPayload {
  visita_id: number
  impresora_id: number
  contrato_id?: number | null
  fecha: string
  valor_contador: number
  foto_evidencia?: string | null
  justificacion_anomalia?: string | null
  ubicacion_lat?: number | null
  ubicacion_lng?: number | null
}

export type QueueEstado = 'pendiente' | 'error'

export interface QueueItem {
  id: string
  type: 'reading'
  payload: ReadingPayload
  created_at: string
  estado: QueueEstado
  error_msg?: string
}

const DB_NAME = 'redprint_mobile'
const DB_VERSION = 1
const STORE = 'sync_queue'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB no disponible'))
  })
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Error de IndexedDB'))
  })
}

export async function getAllQueue(): Promise<QueueItem[]> {
  const items = await withStore<QueueItem[]>(
    'readonly',
    (s) => s.getAll() as IDBRequest<QueueItem[]>
  )
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function putItem(item: QueueItem): Promise<void> {
  await withStore('readwrite', (s) => s.put(item))
}

export async function deleteItem(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}
