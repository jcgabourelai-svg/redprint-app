import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ShoppingBag,
  Calendar,
  FileText,
  Package,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { usePurchase, useReceivePurchase, useCancelPurchase } from '@/hooks/usePurchases'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'
import type { Purchase } from '@/types/purchase'

const metodoPagoLabels: Record<string, string> = {
  contado: 'Contado',
  credito: 'Crédito',
  parcial: 'Pago parcial',
}

const metodoPagoIcons: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
}

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: purchase, isLoading, error } = usePurchase(Number(id))
  const receivePurchase = useReceivePurchase()
  const cancelPurchase = useCancelPurchase()
  const [receiveError, setReceiveError] = useState('')

  if (isLoading) {
    return (
      <PageLayout title="Cargando...">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando compra...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !purchase) {
    return (
      <PageLayout title="Compra no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Compra no encontrada</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/finanzas/compras')}>
            Volver a compras
          </Button>
        </div>
      </PageLayout>
    )
  }

  const subtotalArticulos = purchase.articulos.reduce((sum, a) => sum + a.subtotal, 0)
  const porcentajePagado = purchase.monto_total > 0 ? Math.round(((purchase.monto_total - purchase.saldo_pendiente) / purchase.monto_total) * 100) : 0

  const handleReceive = async () => {
    setReceiveError('')
    try {
      await receivePurchase.mutateAsync(Number(id))
    } catch (err) {
      setReceiveError(parseApiError(err))
    }
  }

  const handleCancel = async () => {
    setReceiveError('')
    try {
      await cancelPurchase.mutateAsync(Number(id))
    } catch (err) {
      setReceiveError(parseApiError(err))
    }
  }

  return (
    <PageLayout title={`Finanzas › Compras › ${purchase.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/finanzas/compras')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="flex gap-2">
            {purchase.estado === 'PENDIENTE' && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleReceive}
                  disabled={receivePurchase.isPending}
                >
                  {receivePurchase.isPending ? 'Procesando...' : 'Recibir'}
                </Button>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelPurchase.isPending}
                >
                  {cancelPurchase.isPending ? 'Cancelando...' : 'Cancelar'}
                </Button>
              </>
            )}
          </div>
        </div>

        {receiveError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{receiveError}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{purchase.id}</CardTitle>
                  <p className="text-sm text-muted-foreground">{purchase.proveedor}</p>
                  <p className="text-xs text-muted-foreground">{purchase.concepto}</p>
                </div>
              </div>
              <Badge
                variant={purchase.estado === 'RECIBIDA' ? 'success' : purchase.estado === 'CANCELADA' ? 'error' : 'warning'}
              >
                {purchase.estado.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Datos de la Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor</p>
                  <p className="text-sm font-medium">{purchase.proveedor}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">No. Factura proveedor</p>
                  <p className="text-sm font-medium">{purchase.numero_factura_proveedor || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Método de pago</p>
                  <p className="text-sm font-medium">{metodoPagoLabels[purchase.metodo_pago]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registrado por</p>
                  <p className="text-sm font-medium">{purchase.socio_registro}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Fechas y Montos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de compra</p>
                  <p className="text-sm font-medium">{formatDate(purchase.fecha_compra)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimiento de pago</p>
                  <p className="text-sm font-medium">
                    {purchase.fecha_vencimiento_pago ? formatDate(purchase.fecha_vencimiento_pago) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto total</p>
                  <p className="text-sm font-bold">{formatCurrency(purchase.monto_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p className={`text-sm font-bold ${purchase.saldo_pendiente > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(purchase.saldo_pendiente)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progreso de pago</span>
                  <span>{porcentajePagado}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${porcentajePagado === 100 ? 'bg-success' : porcentajePagado > 0 ? 'bg-primary' : 'bg-border'}`}
                    style={{ width: `${porcentajePagado}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Monto Total</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(purchase.monto_total)}</p>
          </div>
          <div className="text-center p-4 bg-success/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Pagado</p>
            <p className="text-xl font-bold text-success">{formatCurrency(purchase.monto_total - purchase.saldo_pendiente)}</p>
          </div>
          <div className="text-center p-4 bg-destructive/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Saldo Pendiente</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(purchase.saldo_pendiente)}</p>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Artículos</p>
            <p className="text-xl font-bold text-primary">{purchase.articulos.length}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-6 pb-0">
              <Tabs
                tabs={[
                  {
                    id: 'articulos',
                    label: `Artículos (${purchase.articulos.length})`,
                    content: (
                      <div className="pb-4">
                        {purchase.articulos.length === 0 ? (
                          <div className="text-center py-8">
                            <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No hay artículos registrados</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Artículo</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Costo Unitario</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {purchase.articulos.map((art) => (
                                  <tr key={art.articulo_id} className="border-b border-border">
                                    <td className="py-2">
                                      <p className="font-medium text-foreground">{art.articulo_nombre}</p>
                                      <p className="text-xs text-muted-foreground">{art.articulo_id}</p>
                                    </td>
                                    <td className="py-2 text-right text-muted-foreground">{art.cantidad}</td>
                                    <td className="py-2 text-right text-muted-foreground">{formatCurrency(art.costo_unitario)}</td>
                                    <td className="py-2 text-right font-medium">{formatCurrency(art.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-border">
                                  <td colSpan={3} className="pt-2 text-right text-sm font-medium text-muted-foreground">
                                    Subtotal artículos:
                                  </td>
                                  <td className="pt-2 text-right font-bold">{formatCurrency(subtotalArticulos)}</td>
                                </tr>
                                {purchase.mano_de_obra > 0 && (
                                  <tr>
                                    <td colSpan={3} className="py-1 text-right text-sm text-muted-foreground">
                                      Mano de obra:
                                    </td>
                                    <td className="py-1 text-right font-medium">{formatCurrency(purchase.mano_de_obra)}</td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'notas',
                    label: 'Notas',
                    content: (
                      <div className="pb-4">
                        {purchase.notas ? (
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{purchase.notas}</p>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Sin notas adicionales</p>
                          </div>
                        )}
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