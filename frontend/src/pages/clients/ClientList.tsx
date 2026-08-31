import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import ClientFormModal from '@/components/clients/ClientFormModal'
import type { Client } from '@/types/client'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { formatCurrency } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const estadoLabels: Record<string, string> = {
  al_corriente: 'Al corriente',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
}

export default function ClientList() {
  const navigate = useNavigate()
  const { data: clients, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Client>({
    queryKey: ['clients'],
    fetcher: (p) => api.get('/clients', { params: p }).then((r) => r.data),
  })

  const [showNewClientModal, setShowNewClientModal] = useState(false)

  const columns = [
    {
      key: 'razon_social',
      label: 'Cliente',
      sortable: true,
      render: (_value: string, row: Client) => (
        <div>
          <p className="font-medium text-foreground">{row.razon_social}</p>
          <p className="text-xs text-muted-foreground">{row.nombre_contacto}</p>
          <p className="text-xs text-muted-foreground">Tel: {row.telefono}</p>
        </div>
      ),
    },
    {
      key: 'contratos_activos_count',
      label: 'Contratos',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{value ?? 0}</span>
      ),
    },
    {
      key: 'saldo_pendiente',
      label: 'Saldo Pendiente',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${(value ?? 0) > 0 ? 'text-destructive' : 'text-success'}`}>
          {formatCurrency(value ?? 0)}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="client_status" color={value}>
          {estadoLabels[value] || value}
        </Badge>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Clientes" showSearch>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Clientes" showSearch>
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Clientes" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
            <p className="text-sm text-muted-foreground">
              Gestión de clientes y contratos de renta
            </p>
          </div>
          <Button onClick={() => setShowNewClientModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>

        {clients.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={Users}
            title="No hay clientes"
            description="Registra tu primer cliente para gestionar contratos y visitas."
            action={{ label: 'Nuevo Cliente', onClick: () => setShowNewClientModal(true) }}
          />
        ) : (
          <Table
            data={clients}
            columns={columns}
            searchable={true}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage="No se encontraron clientes con los filtros aplicados."
            onRowClick={(client) => navigate(`/clientes/${client.id}`)}
          />
        )}
      </div>

      <ClientFormModal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
      />
    </PageLayout>
  )
}