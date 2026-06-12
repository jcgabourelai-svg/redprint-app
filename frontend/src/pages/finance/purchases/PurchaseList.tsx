import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, DollarSign, ShoppingBag, Trash2 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { usePurchases, useCreatePurchase, useReceivePurchase, useCancelPurchase } from '@/hooks/usePurchases'
import type { Purchase } from '@/types/purchase'

const proveedores = [
  { value: 'HP México', label: 'HP México' },
  { value: 'Taller HP', label: 'Taller HP' },
  { value: 'Impresoras del Norte', label: 'Impresoras del Norte' },
  { value: 'Canon México', label: 'Canon México' },
  { value: 'Epson Distribuciones', label: 'Epson Distribuciones' },
  { value: 'Brother México', label: 'Brother México' },
]

const articulos = [
  { value: 'ART-001', label: 'Tóner HP 85A' },
  { value: 'ART-002', label: 'Tambor Canon 1435iF' },
  { value: 'ART-003', label: 'Fusor HP M404' },
  { value: 'ART-004', label: 'Rodillo HP' },
  { value: 'ART-005', label: 'Tóner Brother TN-2420' },
  { value: 'ART-006', label: 'Kit mantenimiento Canon' },
  { value: 'ART-007', label: 'Cartucho Epson 664 Negro' },
  { value: 'ART-008', label: 'Cartucho Epson 664 Color' },
]

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

export default function PurchaseList() {
  const navigate = useNavigate()
  const { data: purchasesData, isLoading, error } = usePurchases()
  const [statusFilter, setStatusFilter] = useState('')
  const [proveedorFilter, setProveedorFilter] = useState('')
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const createPurchase = useCreatePurchase()
  const receivePurchase = useReceivePurchase()
  const cancelPurchase = useCancelPurchase()
  const [purchaseForm, setPurchaseForm] = useState({
    proveedor: '',
    fecha_compra: new Date().toISOString().split('T')[0],
    concepto: '',
    metodo_pago: 'contado' as 'contado' | 'credito' | 'parcial',
    numero_factura_proveedor: '',
    mano_de_obra: 0,
    fecha_vencimiento_pago: '',
    socio_registro: '',
    notas: '',
    articulos: [{ articulo_id: '', cantidad: 1, costo_unitario: 0 }] as { articulo_id: string; cantidad: number; costo_unitario: number }[],
  })

  const purchases = purchasesData?.data || []
  const filteredPurchases = purchases
    .filter((p) => (!statusFilter || p.estado === statusFilter))
    .filter((p) => (!proveedorFilter || p.proveedor === proveedorFilter))

  const subtotalArticulos = purchaseForm.articulos.reduce((sum, a) => sum + (a.cantidad * a.costo_unitario), 0)
  const iva = (subtotalArticulos + purchaseForm.mano_de_obra) * 0.16
  const totalCompra = subtotalArticulos + purchaseForm.mano_de_obra + iva

  const totalPendiente = filteredPurchases.reduce((sum, p) => sum + (p.saldo_pendiente ?? 0), 0)

  const columns = [
    {
      key: 'id',
      label: 'Compra',
      sortable: true,
      render: (_value: string, row: Purchase) => (
        <div>
          <p className="font-medium text-gray-900">{row.id}</p>
          <p className="text-xs text-gray-500">{formatDate(row.fecha_compra)}</p>
          {row.fecha_vencimiento_pago && <p className="text-xs text-gray-400">Vence: {formatDate(row.fecha_vencimiento_pago)}</p>}
          <p className="text-xs text-gray-400 mt-1 capitalize">{row.metodo_pago}</p>
        </div>
      ),
    },
    {
      key: 'proveedor',
      label: 'Proveedor',
      sortable: true,
      render: (_value: string, row: Purchase) => (
        <div>
          <p className="font-medium">{row.proveedor}</p>
          <p className="text-xs text-gray-500">{row.concepto}</p>
          {row.articulos?.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Artículos: {row.articulos.map(a => `${a.articulo_nombre} (${a.cantidad})`).join(', ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'monto_total',
      label: 'Monto Total',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'saldo_pendiente',
      label: 'Saldo Pendiente',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="document_status" color={value === 'RECIBIDA' ? 'success' : value === 'CANCELADA' ? 'error' : 'warning'}>
          {statusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Purchase) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/finanzas/compras/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          {row.estado === 'PENDIENTE' && (
            <>
              <button 
                className="p-1 hover:bg-gray-100 rounded" 
                title="Recibir"
                onClick={() => receivePurchase.mutate(Number(row.id))}
                disabled={receivePurchase.isPending}
              >
                <Plus className="h-4 w-4 text-blue-500" />
              </button>
              <button
                className="p-1 hover:bg-gray-100 rounded"
                title="Registrar pago"
              >
                <DollarSign className="h-4 w-4 text-green-500" />
              </button>
            </>
          )}
          <button 
            className="p-1 hover:bg-gray-100 rounded" 
            title="Cancelar"
            onClick={() => cancelPurchase.mutate(Number(row.id))}
            disabled={cancelPurchase.isPending || row.estado !== 'pendiente'}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ]

  const hasFilters = statusFilter || proveedorFilter
  const clearFilters = () => {
    setStatusFilter('')
    setProveedorFilter('')
  }

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Compras a Proveedores</h2>
            <p className="text-sm text-gray-500">Registro de compras y afectación de inventario</p>
          </div>
          <Button onClick={() => setShowNewPurchase(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Compra
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando compras...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error al cargar compras: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <ShoppingBag className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Compras</p>
                      <p className="text-lg font-bold">{purchases.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-50 p-2">
                      <ShoppingBag className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Monto Total</p>
                      <p className="text-lg font-bold">{formatCurrency(purchases.reduce((s, p) => s + (p.monto_total ?? 0), 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-yellow-50 p-2">
                      <DollarSign className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pendiente por Pagar</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(purchases.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-48">
                <Select
                  options={[
                    { value: '', label: 'Todos los estados' },
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'recibida', label: 'Recibida' },
                    { value: 'CANCELADA', label: 'Cancelada' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Filtrar por estado"
                />
              </div>
              <div className="w-56">
                <Select
                  options={[
                    { value: '', label: 'Todos los proveedores' },
                    ...proveedores,
                  ]}
                  value={proveedorFilter}
                  onChange={setProveedorFilter}
                  placeholder="Filtrar por proveedor"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>

            <Table
              data={filteredPurchases}
              columns={columns}
              searchable={true}
              sortable={true}
              paginatable={true}
              pageSize={10}
              emptyMessage="No hay compras registradas"
              onRowClick={(row) => navigate(`/finanzas/compras/${row.id}`)}
            />

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total pendiente: <strong className="text-red-600">{formatCurrency(totalPendiente)}</strong></span>
              <span>Mostrando {filteredPurchases.length} de {purchases.length} compras</span>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showNewPurchase}
        onClose={() => setShowNewPurchase(false)}
        title="Registrar Compra"
        size="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
            <Select
              options={proveedores}
              value={purchaseForm.proveedor}
              onChange={(v) => setPurchaseForm({ ...purchaseForm, proveedor: v })}
              placeholder="Seleccionar proveedor"
              searchable
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de compra *</label>
              <Input
                type="date"
                value={purchaseForm.fecha_compra}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, fecha_compra: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Factura proveedor</label>
              <Input
                value={purchaseForm.numero_factura_proveedor}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, numero_factura_proveedor: e.target.value })}
                placeholder="FAC-001-HP"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
            <Input
              value={purchaseForm.concepto}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, concepto: e.target.value })}
              placeholder="Descripción de la compra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago *</label>
            <Select
              options={[
                { value: 'contado', label: 'Contado' },
                { value: 'credito', label: 'Crédito' },
                { value: 'parcial', label: 'Parcial' },
              ]}
              value={purchaseForm.metodo_pago}
              onChange={(v) => setPurchaseForm({ ...purchaseForm, metodo_pago: v })}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Artículos de la compra</h4>
            {purchaseForm.articulos.map((art, index) => (
              <div key={index} className="flex items-end gap-3 mb-3">
                <div className="flex-1">
                  <Select
                    options={articulos}
                    value={art.articulo_id}
                    onChange={(v) => {
                      const newArts = [...purchaseForm.articulos]
                      newArts[index] = { ...newArts[index], articulo_id: v }
                      setPurchaseForm({ ...purchaseForm, articulos: newArts })
                    }}
                    placeholder="Seleccionar artículo"
                  />
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    placeholder="Cant."
                    value={art.cantidad}
                    onChange={(e) => {
                      const newArts = [...purchaseForm.articulos]
                      newArts[index] = { ...newArts[index], cantidad: Number(e.target.value) }
                      setPurchaseForm({ ...purchaseForm, articulos: newArts })
                    }}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    placeholder="Costo unit."
                    value={art.costo_unitario}
                    onChange={(e) => {
                      const newArts = [...purchaseForm.articulos]
                      newArts[index] = { ...newArts[index], costo_unitario: Number(e.target.value) }
                      setPurchaseForm({ ...purchaseForm, articulos: newArts })
                    }}
                  />
                </div>
                <span className="text-sm font-medium pb-2">{formatCurrency(art.cantidad * art.costo_unitario)}</span>
                {purchaseForm.articulos.length > 1 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      const newArts = purchaseForm.articulos.filter((_, i) => i !== index)
                      setPurchaseForm({ ...purchaseForm, articulos: newArts })
                    }}
                  >
                    X
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setPurchaseForm({
              ...purchaseForm,
              articulos: [...purchaseForm.articulos, { articulo_id: '', cantidad: 1, costo_unitario: 0 }]
            })}>
              + Agregar artículo
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Costo de mano de obra ($)</label>
            <Input
              type="number"
              value={purchaseForm.mano_de_obra}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, mano_de_obra: Number(e.target.value) })}
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Total artículos:</span><span>{formatCurrency(subtotalArticulos)}</span></div>
              <div className="flex justify-between"><span>Mano de obra:</span><span>{formatCurrency(purchaseForm.mano_de_obra)}</span></div>
              <div className="flex justify-between"><span>IVA (16%):</span><span>{formatCurrency(iva)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total:</span><span>{formatCurrency(totalCompra)}</span></div>
            </div>
          </div>

          {(purchaseForm.metodo_pago === 'credito' || purchaseForm.metodo_pago === 'parcial') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento de pago</label>
              <Input
                type="date"
                value={purchaseForm.fecha_vencimiento_pago}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, fecha_vencimiento_pago: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio que registra *</label>
            <Select
              options={[
                { value: 'socio1', label: 'María López' },
                { value: 'socio2', label: 'Juan Pérez' },
                { value: 'socio3', label: 'Carlos Gómez' },
              ]}
              value={purchaseForm.socio_registro}
              onChange={(v) => setPurchaseForm({ ...purchaseForm, socio_registro: v })}
              placeholder="Seleccionar socio"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={purchaseForm.notas}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, notas: e.target.value })}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowNewPurchase(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                createPurchase.mutate(purchaseForm, {
                  onSuccess: () => {
                    setShowNewPurchase(false)
                  }
                })
              }}
              disabled={createPurchase.isPending}
            >
              {createPurchase.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}