import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, MoreVertical, Eye, FileText } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import type { Client } from '@/types/client'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { formatCurrency } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const estadoLabels: Record<string, string> = {
  al_corriente: 'Al corriente',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
}

export default function ClientList() {
  const navigate = useNavigate()
  const { data: clientsData, isLoading, error } = useClients()
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

  const clients = clientsData?.data || []

  const columns = [
    {
      key: 'razon_social',
      label: 'Cliente',
      sortable: true,
      render: (_value: string, row: Client) => (
        <div>
          <p className="font-medium text-gray-900">{row.razon_social}</p>
          <p className="text-xs text-gray-500">{row.nombre_contacto}</p>
          <p className="text-xs text-gray-400">Tel: {row.telefono}</p>
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
        <span className={`font-medium ${(value ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Client) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clientes/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          <button
            className="p-1 hover:bg-gray-100 rounded"
            title="Contratos"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/contratos?cliente=${row.id}`)
            }}
          >
            <FileText className="h-4 w-4 text-gray-500" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Más opciones">
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
        </div>
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
          <p className="text-gray-500">Cargando clientes...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Clientes" showSearch>
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Clientes" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
            <p className="text-sm text-gray-500">
              Gestión de clientes y contratos de renta
            </p>
          </div>
          <Button onClick={() => setShowNewClientModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>

        <Table
          data={clients}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={25}
          emptyMessage="No hay clientes registrados"
          onRowClick={(client) => navigate(`/clientes/${client.id}`)}
        />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón social / Nombre *
            </label>
            <Input
              value={newClient.razon_social}
              onChange={(e) => setNewClient({ ...newClient, razon_social: e.target.value })}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RFC / Identificación fiscal
            </label>
            <Input
              value={newClient.rfc}
              onChange={(e) => setNewClient({ ...newClient, rfc: e.target.value })}
              placeholder="AAAA010101ABC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del contacto *
            </label>
            <Input
              value={newClient.nombre_contacto}
              onChange={(e) => setNewClient({ ...newClient, nombre_contacto: e.target.value })}
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono *
            </label>
            <Input
              value={newClient.telefono}
              onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
              placeholder="55-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección de instalación *
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={newClient.direccion_instalacion}
              onChange={(e) => setNewClient({ ...newClient, direccion_instalacion: e.target.value })}
              placeholder="Av. Reforma 123, Col. Centro, CDMX, 06000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={newClient.notas}
              onChange={(e) => setNewClient({ ...newClient, notas: e.target.value })}
              placeholder="Observaciones del cliente"
            />
          </div>
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
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