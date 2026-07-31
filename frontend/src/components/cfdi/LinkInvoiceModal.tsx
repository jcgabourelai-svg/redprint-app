import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLinkCfdi } from '@/hooks/useCfdi'
import { parseApiError } from '@/lib/api-errors'
import { formatCurrency, formatDate } from '@/lib/formatters'
import api from '@/lib/api'
import type { PaginatedResponse } from '@/types/api'

interface SelectableInvoice {
  id: number
  numero_factura: string
  fecha_emision?: string | null
  monto_total: number
  saldo_pendiente: number
  estado?: string | null
  client?: { razon_social?: string | null } | null
  xml_comprobante_id?: number | null
}

interface LinkInvoiceModalProps {
  cfdiId: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

export default function LinkInvoiceModal({
  cfdiId,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: LinkInvoiceModalProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const linkCfdi = useLinkCfdi()

  const { data, isLoading } = useQuery<PaginatedResponse<SelectableInvoice>>({
    queryKey: ['invoices', { cfdi_select: search }],
    queryFn: () =>
      api
        .get('/invoices', { params: { per_page: 50, search } })
        .then((r) => r.data),
    enabled: isOpen,
  })

  const items = useMemo(() => {
    const all = data?.data ?? []
    // Solo facturas que aun no tienen CFDI vinculado.
    return all.filter((i) => i.xml_comprobante_id == null)
  }, [data])

  const handleSubmit = async () => {
    if (!cfdiId || selectedId == null) return
    try {
      await linkCfdi.mutateAsync({ id: cfdiId, invoiceId: selectedId })
      onSuccess('Comprobante vinculado a la factura.')
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Vincular a factura" size="lg">
      <div className="space-y-4">
        <Input
          placeholder="Buscar por numero de factura o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando facturas...</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay facturas disponibles para vincular.
            </p>
          ) : (
            items.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => setSelectedId(inv.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted ${
                  selectedId === inv.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.numero_factura}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv.client?.razon_social ?? 'Sin cliente'} - {formatDate(inv.fecha_emision)}
                  </p>
                </div>
                <span className="text-sm font-medium ml-2">
                  {formatCurrency(inv.monto_total)}
                </span>
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
