import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, MoreVertical, Eye } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { Contract, ContractStatus } from '@/types/contract'
import { useContracts } from '@/hooks/useContracts'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const estadoLabels: Record<ContractStatus, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

function getEsquemaLabel(contract: Contract): string {
  if (contract.tarifa_base === 0 && contract.paginas_incluidas === 0) return 'Puro consumo'
  if (contract.costo_por_pagina_excedente === 0) return 'Renta fija'
  return 'Tarifa base + páginas excedentes'
}

export default function ContractList() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const { data: contractsData, isLoading, error } = useContracts()
  
  const contracts = contractsData?.data || []
  
  const filteredContracts = useMemo(() => {
    return statusFilter === 'todos'
      ? contracts
      : contracts.filter((c) => c.estado === statusFilter)
  }, [contracts, statusFilter])

  if (isLoading) {
    return (
      <PageLayout title="Contratos" showSearch>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando contratos...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Contratos" showSearch>
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  const columns = [
    {
      key: 'id',
      label: 'Contrato',
      sortable: true,
      render: (_value: string, row: Contract) => (
        <div>
          <p className="font-medium text-gray-900">{row.id}</p>
          <p className="text-xs text-gray-500">{formatDate(row.fecha_inicio)}</p>
        </div>
      ),
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      sortable: true,
      render: (_value: string, row: Contract) => (
        <div>
          <p className="font-medium text-gray-900">{row.cliente_nombre}</p>
          <p className="text-xs text-gray-500">{row.cliente_contacto}</p>
        </div>
      ),
    },
    {
      key: 'impresoras',
      label: 'Impresoras',
      render: (_value: unknown, row: Contract) => {
        const impresoras = row.impresoras ?? []
        return (
          <div>
            <p className="font-medium">{impresoras.length}</p>
            <div className="text-xs text-gray-500">
              {impresoras.slice(0, 2).map((p) => p.impresora_id).join(', ')}
              {impresoras.length > 2 && '...'}
            </div>
          </div>
        )
      },
    },
    {
      key: 'tarifa_base',
      label: 'Esquema de Cobro',
      render: (_value: unknown, row: Contract) => (
        <span className="text-sm">{getEsquemaLabel(row)}</span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: ContractStatus) => (
        <Badge variant="contract_status" color={value}>
          {estadoLabels[value]}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Contract) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/contratos/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Más opciones">
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageLayout title="Contratos" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contratos</h2>
            <p className="text-sm text-gray-500">
              Gestión de contratos de renta de impresoras
            </p>
          </div>
          <Button onClick={() => navigate('/contratos/crear')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Contrato
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Estado:</span>
            <select
              className="rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="SUSPENDIDO">Suspendido</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
          {statusFilter !== 'todos' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('todos')}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <Table
          data={filteredContracts}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={25}
          emptyMessage="No hay contratos registrados"
          onRowClick={(contract) => navigate(`/contratos/${contract.id}`)}
        />
      </div>
    </PageLayout>
  )
}