import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLinkCfdi } from '@/hooks/useCfdi'
import { parseApiError } from '@/lib/api-errors'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import api from '@/lib/api'
import type { PaginatedResponse } from '@/types/api'
import type { XmlComprobante } from '@/types/cfdi'

interface LinkCfdiModalProps {
  invoiceId: number | string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

export default function LinkCfdiModal({
  invoiceId,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: LinkCfdiModalProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const linkCfdi = useLinkCfdi()

  // Solo CFDI de ingreso y sin factura (los unicos vinculables a una factura).
  const { data, isLoading } = useQuery<PaginatedResponse<XmlComprobante>>({
    queryKey: ['cfdi', { link_select: search }],
    queryFn: () =>
      api
        .get('/cfdi', {
          params: {
            per_page: 50,
            search,
            tipo_comprobante: 'I',
            estado_conciliacion: 'sin_factura',
          },
        })
        .then((r) => r.data),
    enabled: isOpen,
  })

  const items = useMemo(() => data?.data ?? [], [data])

  const handleSubmit = async () => {
    if (!invoiceId || selectedId == null) return
    try {
      await linkCfdi.mutateAsync({ id: selectedId, invoiceId: Number(invoiceId) })
      onSuccess('Factura vinculada al comprobante.')
      onClose()
      setSearch('')
      setSelectedId(null)
    } catch (err) {
      onError(parseApiError(err))
    }
  }

  const handleClose = () => {
    setSearch('')
    setSelectedId(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Vincular CFDI" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecciona un comprobante de ingreso sin factura para vincularlo a esta factura.
        </p>

        <Input
          placeholder="Buscar por UUID, serie-folio o receptor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando comprobantes...</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay comprobantes disponibles para vincular.
            </p>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted ${
                  selectedId === c.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.serie_folio ?? c.uuid.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.nombre_receptor ?? c.rfc_receptor} - {formatDateTime(c.fecha_emision)}
                  </p>
                </div>
                <span className="text-sm font-medium ml-2">{formatCurrency(c.total)}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} disabled={linkCfdi.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={linkCfdi.isPending}
            disabled={selectedId == null}
          >
            Vincular
          </Button>
        </div>
      </div>
    </Modal>
  )
}
