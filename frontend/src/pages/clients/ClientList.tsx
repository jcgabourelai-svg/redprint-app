import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import type { Client } from '@/types/client'
import api from '@/lib/api'
import { useCreateClient } from '@/hooks/useClients'
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
  const createClient = useCreateClient()

  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClient, setNewClient] = useState({
    razon_social: '',
    rfc: '',
    nombre_contacto: '',
    telefono: '',
    correo: '',
    direccion_instalacion: '',
    notas: '',
  })
  const [createError, setCreateError] = useState('')

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

  const handleCreateClient = () => {
    setCreateError('')
    createClient.mutate(newClient, {
      onSuccess: () => {
        setShowNewClientModal(false)
        setNewClient({
          razon_social: '',
          rfc: '',
          nombre_contacto: '',
          telefono: '',
          correo: '',
          direccion_instalacion: '',
          notas: '',
        })
      },
      onError: (err) => {
        setCreateError(parseApiError(err))
      },
    })
  }

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

      <Modal
        isOpen={showNewClientModal}
        onClose={() => {
          setShowNewClientModal(false)
          setCreateError('')
        }}
        title="Nuevo Cliente"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Razón social / Nombre *
            </label>
            <Input
              value={newClient.razon_social}
              onChange={(e) => setNewClient({ ...newClient, razon_social: e.target.value })}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              RFC / Identificación fiscal
            </label>
            <Input
              value={newClient.rfc}
              onChange={(e) => setNewClient({ ...newClient, rfc: e.target.value })}
              placeholder="AAAA010101ABC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Nombre del contacto *
            </label>
            <Input
              value={newClient.nombre_contacto}
              onChange={(e) => setNewClient({ ...newClient, nombre_contacto: e.target.value })}
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Teléfono *
            </label>
            <Input
              value={newClient.telefono}
              onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
              placeholder="55-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Correo electrónico
            </label>
            <Input
              type="email"
              value={newClient.correo}
              onChange={(e) => setNewClient({ ...newClient, correo: e.target.value })}
              placeholder="correo@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Dirección de instalación *
            </label>
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              value={newClient.direccion_instalacion}
              onChange={(e) => setNewClient({ ...newClient, direccion_instalacion: e.target.value })}
              placeholder="Av. Reforma 123, Col. Centro, CDMX, 06000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Notas
            </label>
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              value={newClient.notas}
              onChange={(e) => setNewClient({ ...newClient, notas: e.target.value })}
              placeholder="Observaciones del cliente"
            />
          </div>
          {createError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {createError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => {
              setShowNewClientModal(false)
              setCreateError('')
            }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateClient} disabled={createClient.isPending}>
              {createClient.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}