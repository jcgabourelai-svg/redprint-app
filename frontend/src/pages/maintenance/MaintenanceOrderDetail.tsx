import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react'
import { useMaintenanceOrder, useCompleteMaintenance, useCancelMaintenance, useAddMaintenanceArticle, useRemoveMaintenanceArticle } from '@/hooks/useMaintenanceOrders'
import type { Article } from '@/types/models'
import { useArticles } from '@/hooks/useArticles'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { MaintenanceType, MaintenanceStatus, MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS } from '@/types/enums'

const statusBadgeVariant: Record<string, 'warning' | 'success' | 'secondary'> = {
  PROGRAMADA: 'warning',
  COMPLETADA: 'success',
  CANCELADA: 'secondary',
}

export default function MaintenanceOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const orderId = Number(id)

  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [addArticleOpen, setAddArticleOpen] = useState(false)
  const [trabajoRealizado, _setTrabajoRealizado] = useState('')
  const [selectedArticle, setSelectedArticle] = useState('')
  const [articleQty, setArticleQty] = useState('1')
  const [articleCost, setArticleCost] = useState('')

  const { data: order, isLoading, isError, refetch } = useMaintenanceOrder(orderId)
  const completeMutation = useCompleteMaintenance()
  const cancelMutation = useCancelMaintenance()
  const addArticleMutation = useAddMaintenanceArticle()
  const removeArticleMutation = useRemoveMaintenanceArticle()
  const { data: articlesData } = useArticles({ page: 1, per_page: 100 })

  const articleOptions = articlesData?.data.map((a: Article) => ({
    value: String(a.id),
    label: a.nombre,
  })) ?? []

  const isProgramada = order?.estado === MaintenanceStatus.PROGRAMADA

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync({ id: orderId, trabajo_realizado: trabajoRealizado })
      addToast('Orden completada', 'success')
      refetch()
    } catch {
      addToast('Error al completar la orden', 'error')
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(orderId)
      addToast('Orden cancelada', 'success')
      refetch()
    } catch {
      addToast('Error al cancelar la orden', 'error')
    }
  }

  const handleAddArticle = async () => {
    try {
      await addArticleMutation.mutateAsync({
        orderId,
        articulo_id: Number(selectedArticle),
        cantidad: Number(articleQty),
        costo_unitario: Number(articleCost),
      })
      addToast('Articulo agregado', 'success')
      setAddArticleOpen(false)
      setSelectedArticle('')
      setArticleQty('1')
      setArticleCost('')
      refetch()
    } catch {
      addToast('Error al agregar articulo', 'error')
    }
  }

  const handleRemoveArticle = async (articleUsedId: number) => {
    try {
      await removeArticleMutation.mutateAsync({ orderId, articleUsedId })
      addToast('Articulo removido', 'success')
      refetch()
    } catch {
      addToast('Error al remover articulo', 'error')
    }
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando orden..." />
  }

  if (isError || !order) {
    return <ErrorMessage message="Error al cargar la orden de mantenimiento" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orden #{order.id}</h1>
          <p className="text-muted-foreground">
            {MAINTENANCE_TYPE_LABELS[order.tipo_mantto as MaintenanceType]} - {formatDate(order.fecha)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant[order.estado] ?? 'secondary'}>
            {MAINTENANCE_STATUS_LABELS[order.estado as MaintenanceStatus] ?? order.estado}
          </Badge>
          {isProgramada && (
            <>
              <Button onClick={() => setCompleteOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Completar
              </Button>
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Impresora</p>
              <p className="font-medium">
                {order.printer
                  ? `${order.printer.codigo_negocio} - ${order.printer.marca} ${order.printer.modelo}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Proveedor</p>
              <p className="font-medium">{order.supplier?.razon_social ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Descripcion del Problema</p>
              <p className="font-medium">{order.desc_problema ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trabajo Realizado</p>
              <p className="font-medium">{order.trabajo_realizado ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Costo Mano de Obra</p>
              <p className="font-medium">{formatCurrency(order.costo_mano_obra)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Costo Total</p>
              <p className="font-medium">{formatCurrency(order.costo_total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Articulos Utilizados</CardTitle>
          {isProgramada && (
            <Button size="sm" onClick={() => setAddArticleOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!order.articles_used?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin articulos registrados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articulo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo Unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {isProgramada && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.articles_used.map((au) => (
                  <TableRow key={au.id}>
                    <TableCell className="font-medium">{au.article?.nombre ?? '-'}</TableCell>
                    <TableCell className="text-right">{au.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(au.costo_unitario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(au.subtotal)}</TableCell>
                    {isProgramada && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveArticle(au.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={handleComplete}
        title="Completar Orden"
        message="¿Confirmas que deseas completar esta orden de mantenimiento?"
        confirmLabel="Completar"
      />

      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancelar Orden"
        message="¿Confirmas que deseas cancelar esta orden de mantenimiento?"
        confirmLabel="Cancelar"
        variant="destructive"
      />

      <Modal
        isOpen={addArticleOpen}
        onClose={() => setAddArticleOpen(false)}
        title="Agregar Articulo"
      >
        <div className="space-y-4">
          <Select
            label="Articulo"
            options={articleOptions}
            value={selectedArticle}
            onChange={(e) => setSelectedArticle(e.target.value)}
            placeholder="Selecciona un articulo"
          />
          <Input
            label="Cantidad"
            type="number"
            min="1"
            value={articleQty}
            onChange={(e) => setArticleQty(e.target.value)}
          />
          <Input
            label="Costo Unitario"
            type="number"
            min="0"
            step="0.01"
            value={articleCost}
            onChange={(e) => setArticleCost(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddArticleOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddArticle}
              loading={addArticleMutation.isPending}
              disabled={!selectedArticle || !articleCost}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
