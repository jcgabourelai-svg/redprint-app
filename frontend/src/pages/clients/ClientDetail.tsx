import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Plus,
  Eye,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useClient } from '@/hooks/useClients'
import { useContracts } from '@/hooks/useContracts'
import type { Client } from '@/types/client'
import type { Contract } from '@/types/contract'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const estadoLabels: Record<string, string> = {
  al_corriente: 'Al corriente',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
}

function getContractClienteNombre(contract: Contract): string {
  return contract.cliente_nombre || contract.cliente_nombre || contract.cliente_contacto || ''
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')
  
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(idNum)
  const { data: contractsData, isLoading: contractsLoading, error: contractsError } = useContracts({ cliente_id: idNum })

  if (!idNum) {
    return (
      <PageLayout title="Cliente no encontrado">
        <div className="text-center py-12">
          <p className="text-gray-500">ID de cliente inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/clientes')}>
            Volver a clientes
          </Button>
        </div>
      </PageLayout>
    )
  }

  if (clientLoading) {
    return (
      <PageLayout title="Cargando cliente...">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando información del cliente...</p>
        </div>
      </PageLayout>
    )
  }

  if (clientError || !client) {
    return (
      <PageLayout title="Cliente no encontrado">
        <div className="text-center py-12">
          <p className="text-red-500">{parseApiError(clientError)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/clientes')}>
            Volver a clientes
          </Button>
        </div>
      </PageLayout>
    )
  }

  const contracts = contractsData?.data || []
  const ingresos = client.rentabilidad && client.rentabilidad > 0 ? 45000 : 10000
  const costos = ingresos - (client.rentabilidad ?? 0)
  const margen = ingresos > 0 ? Math.round(((client.rentabilidad ?? 0) / ingresos) * 100) : 0

  return (
    <PageLayout title={`Clientes › ${client.razon_social}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="danger" size="sm" disabled={contracts.length > 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-blue-100">
                  <span className="text-xl font-bold text-blue-600">
                    {client.razon_social.charAt(0)}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-xl">{client.razon_social}</CardTitle>
                  <p className="text-sm text-gray-500">
                    RFC: {client.rfc || '-'} • ID: {client.id}
                  </p>
                </div>
              </div>
              <Badge variant="client_status" color={client.estado || 'al_corriente'}>
                {estadoLabels[client.estado || 'al_corriente']}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-gray-500">Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{client.nombre_contacto}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{client.telefono}</span>
                </div>
                {client.correo && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{client.correo}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{client.direccion_instalacion}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-gray-500">Estadísticas del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Contratos activos</p>
                  <p className="text-lg font-bold">{client.contratos_activos_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Facturas pendientes</p>
                  <p className="text-lg font-bold">0</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Saldo pendiente</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(client.saldo_pendiente ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rentabilidad</p>
                  <p className={`text-lg font-bold ${(client.rentabilidad ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(client.rentabilidad ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-6 pb-0">
              <Tabs
                tabs={[
                  {
                    id: 'contratos',
                    label: 'Contratos Activos',
                    content: (
                      <div className="space-y-4 pb-4">
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => navigate('/contratos/crear')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Contrato
                          </Button>
                        </div>
                        {contractsLoading ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">Cargando contratos...</p>
                          </div>
                        ) : contractsError ? (
                          <div className="text-center py-8">
                            <p className="text-red-500">{parseApiError(contractsError)}</p>
                          </div>
                        ) : contracts.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500">Este cliente no tiene contratos activos</p>
                            <Button size="sm" className="mt-3" onClick={() => navigate('/contratos/crear')}>
                              Crear primer contrato
                            </Button>
                          </div>
                        ) : (
                          contracts.map((contract) => (
                            <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium">{contract.id} - Activo desde {formatDate(contract.fecha_inicio)}</p>
                                  <p className="text-xs text-gray-500">
                                    {contract.impresoras.length} impresora(s) asignada(s)
                                  </p>
                                </div>
                                <Badge variant="contract_status" color={contract.estado}>
                                  {contract.estado.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                <div>
                                  <span className="text-gray-500">Proxima visita:</span>{' '}
                                  <span className="font-medium">{contract.proxima_visita ? formatDate(contract.proxima_visita) : '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Rentabilidad:</span>{' '}
                                  <span className={`font-medium ${contract.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(contract.rentabilidad || 0)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/contratos/${contract.id}`)}
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  Ver detalle
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'facturas',
                    label: 'Facturas Pendientes',
                    content: (
                      <div className="space-y-4 pb-4">
                        <div className="text-center py-8">
                          <p className="text-gray-500">No hay facturas pendientes</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'rentabilidad',
                    label: 'Rentabilidad',
                    content: (
                      <div className="space-y-4 pb-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Ingresos</p>
                            <p className="text-xl font-bold text-blue-600">{formatCurrency(ingresos)}</p>
                          </div>
                          <div className="text-center p-4 bg-red-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Costos</p>
                            <p className="text-xl font-bold text-red-600">{formatCurrency(costos)}</p>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Rentabilidad</p>
                            <p className={`text-xl font-bold ${(client.rentabilidad ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(client.rentabilidad ?? 0)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">Margen</p>
                            <p className="text-lg font-bold">{margen}%</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">ROI</p>
                            <p className="text-lg font-bold">
                              {costos > 0 ? Math.round(((client.rentabilidad ?? 0) / costos) * 100) : 0}%
                            </p>
                          </div>
                        </div>
                        {contracts.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Rentabilidad por contrato:</p>
                            {contracts.map((contract) => (
                              <div key={contract.id} className="flex justify-between py-1 text-sm">
                                <span className="text-gray-600">{contract.id}</span>
                                <span className={`font-medium ${contract.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(contract.rentabilidad || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'visitas',
                    label: 'Visitas Recientes',
                    content: (
                      <div className="pb-4">
                        <div className="text-center py-8">
                          <p className="text-gray-500">No hay visitas registradas</p>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}