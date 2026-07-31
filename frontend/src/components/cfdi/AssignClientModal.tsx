import { useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useClients } from '@/hooks/useClients'
import { useAssignCfdiClient } from '@/hooks/useCfdi'
import { parseApiError } from '@/lib/api-errors'

interface AssignClientModalProps {
  cfdiId: number | null
  clienteActualId?: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

export default function AssignClientModal({
  cfdiId,
  clienteActualId,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: AssignClientModalProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>(clienteActualId ? String(clienteActualId) : '')
  const assign = useAssignCfdiClient()

  const { data, isLoading } = useClients({ per_page: 100 })

  const options = useMemo(() => {
    const all = data?.data ?? []
    const filtered = search.trim()
      ? all.filter(
          (c) =>
            (c.rfc ?? '').toLowerCase().includes(search.toLowerCase()) ||
            c.razon_social.toLowerCase().includes(search.toLowerCase())
        )
      : all
    return filtered.map((c) => ({
      value: String(c.id),
      label: `${c.razon_social}${c.rfc ? ` - ${c.rfc}` : ''}`,
    }))
  }, [data, search])

  const handleSubmit = async () => {
    if (!cfdiId) return
    try {
      await assign.mutateAsync({
        id: cfdiId,
        cliente_id: selectedId ? Number(selectedId) : null,
      })
      onSuccess('Cliente asignado correctamente.')
      onClose()
    } catch (err) {
      onError(parseApiError(err))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asignar cliente" size="md">
      <div className="space-y-4">
        <Input
          placeholder="Buscar por RFC o razon social..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Cliente
          </label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando clientes...</p>
          ) : (
            <Select
              options={options}
              value={selectedId}
              onChange={(v) => setSelectedId(v)}
              placeholder="Selecciona un cliente"
              searchable
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={assign.isPending} disabled={!selectedId}>
            Asignar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
