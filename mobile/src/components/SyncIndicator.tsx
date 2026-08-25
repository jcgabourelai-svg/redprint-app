import { useState } from 'react'
import { useOnline } from '../hooks/useOnline'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { SyncManager } from '../lib/sync'
import { formatDateTime } from '../lib/format'
import type { QueueItem } from '../lib/db'
import { Button } from './ui'

export default function SyncIndicator() {
  const { items, syncing } = useSyncQueue()
  const online = useOnline()
  const [panelOpen, setPanelOpen] = useState(false)

  const pending = items.filter((i) => i.estado === 'pendiente').length
  const errors = items.filter((i) => i.estado === 'error')

  if (online && pending === 0 && errors.length === 0 && !syncing) return null

  const handleClick = () => {
    if (errors.length > 0) setPanelOpen(true)
    else void SyncManager.sync()
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed right-3 top-16 z-50 flex items-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur"
      >
        {!online && <span>📴</span>}
        <span className={`inline-block text-sm leading-none ${syncing ? 'animate-spin' : ''}`}>
          ⟳
        </span>
        {errors.length > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none">
            {errors.length} error{errors.length > 1 ? 'es' : ''}
          </span>
        ) : (
          pending > 0 && (
            <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] leading-none">
              {pending}
            </span>
          )
        )}
      </button>
      {panelOpen && <ErrorPanel items={errors} onClose={() => setPanelOpen(false)} />}
    </>
  )
}

function ErrorPanel({ items, onClose }: { items: QueueItem[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-800">Lecturas con error</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            El servidor rechazó estas lecturas. Revísalas, reinténtalas o descártalas.
          </p>
        </div>
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  Impresora #{item.payload.impresora_id} · Visita #{item.payload.visita_id}
                </span>
                <span className="text-[11px] text-gray-400">
                  {formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="mb-2 text-xs text-red-600">{item.error_msg ?? 'Error desconocido'}</p>
              <p className="mb-2 text-xs text-gray-500">
                Contador: {item.payload.valor_contador}
                {item.payload.justificacion_anomalia
                  ? ` · Justificación: ${item.payload.justificacion_anomalia}`
                  : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 !py-1.5 !text-xs"
                  onClick={() => void SyncManager.retry(item.id)}
                >
                  Reintentar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1 !py-1.5 !text-xs"
                  onClick={() => void SyncManager.discard(item.id)}
                >
                  Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-gray-100 p-3">
          <Button variant="secondary" block onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
