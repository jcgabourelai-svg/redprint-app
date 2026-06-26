import { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Link2, CheckCircle, AlertTriangle, Download, Mail } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useReconciliationMovements, useLinkMovement, useReconciliationSummary } from '@/hooks/useReconciliation'
import { parseApiError } from '@/lib/api-errors'
import type { BankMovement } from '@/types/bank-movement'

export default function ReconciliationPage() {
  const [cuenta, setCuenta] = useState('BA-001')
  const [periodo, setPeriodo] = useState('mayo-2026')
  const [showVincularModal, setShowVincularModal] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<BankMovement | null>(null)
  const [vincularTipo, setVincularTipo] = useState('cliente')
  const [vincularRef, setVincularRef] = useState('')
  const [linkError, setLinkError] = useState('')

  const { data: movementsData, isLoading } = useReconciliationMovements(cuenta, periodo)
  const { data: summaryData } = useReconciliationSummary(cuenta, periodo)
  const linkMovement = useLinkMovement()

  const movements = movementsData?.data || []
  const summary = summaryData

  const conciliados = movements.filter(m => m.conciliacion_status === 'CONCILIADO')
  const pendientes = movements.filter(m => m.conciliacion_status === 'PENDIENTE')
  const noReconocidos = movements.filter(m => m.conciliacion_status === 'NO_CONCILIADO')

  const montoConciliado = conciliados.reduce((sum, m) => sum + (m.tipo === 'DEPOSITO' ? m.monto : -m.monto), 0)
  const montoPendiente = pendientes.reduce((sum, m) => sum + (m.tipo === 'DEPOSITO' ? m.monto : -m.monto), 0)
  const diferencia = (summary?.saldo_bancario || 0) - montoConciliado

  const handleVincular = (mov: BankMovement) => {
    setSelectedMovement(mov)
    setVincularTipo('cliente')
    setVincularRef('')
    setShowVincularModal(true)
    setLinkError('')
  }

  const handleLinkMovement = async () => {
    setLinkError('')
    try {
      await linkMovement.mutateAsync({
        movimiento_id: selectedMovement?.id,
        transaccion_tipo: vincularTipo,
        transaccion_referencia: vincularRef,
      })
      setShowVincularModal(false)
    } catch (err) {
      setLinkError(parseApiError(err))
    }
  }

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Conciliacion Bancaria</h2>
            <p className="text-sm text-muted-foreground">Concilia movimientos bancarios con transacciones del sistema</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Cuenta</label>
            <Select
              options={[
                { value: 'BA-001', label: 'Cuenta principal - BBVA' },
                { value: 'BA-002', label: 'Cuenta secundaria - Santander' },
              ]}
              value={cuenta}
              onChange={setCuenta}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Periodo</label>
            <Select
              options={[
                { value: 'mayo-2026', label: 'Mayo 2026' },
                { value: 'abril-2026', label: 'Abril 2026' },
                { value: 'marzo-2026', label: 'Marzo 2026' },
              ]}
              value={periodo}
              onChange={setPeriodo}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando datos de conciliación...</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Estado de Conciliacion: <strong>{conciliados.length} movimientos conciliados</strong>,
                  {' '}{pendientes.length} movimientos pendientes de conciliar
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Movimientos Bancarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {movements.slice(0, 10).map((mov) => (
                      <div key={mov.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <div className={`rounded-full p-2 ${mov.tipo === 'DEPOSITO' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {mov.tipo === 'DEPOSITO' ? (
                            <ArrowUpRight className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{mov.descripcion}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(mov.fecha)} · Ref: {mov.referencia}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${mov.tipo === 'DEPOSITO' ? 'text-success' : 'text-destructive'}`}>
                            {mov.tipo === 'DEPOSITO' ? '+' : '-'}{formatCurrency(mov.monto)}
                          </span>
                          <div className="mt-1">
                            {mov.conciliacion_status === 'CONCILIADO' ? (
                              <Badge variant="success">Conciliado</Badge>
                            ) : (
                              <Badge variant="error">Pendiente</Badge>
                            )}
                          </div>
                        </div>
                        {mov.conciliacion_status !== 'conciliado' && (
                          <button
                            onClick={() => handleVincular(mov)}
                            className="p-1 hover:bg-muted rounded"
                            title="Vincular movimiento"
                          >
                            <Link2 className="h-4 w-4 text-primary" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transacciones del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {conciliados.slice(0, 10).map((mov) => (
                      <div key={mov.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <div className={`rounded-full p-2 ${mov.tipo === 'DEPOSITO' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {mov.tipo === 'DEPOSITO' ? (
                            <ArrowUpRight className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{mov.descripcion}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(mov.fecha)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${mov.tipo === 'DEPOSITO' ? 'text-success' : 'text-destructive'}`}>
                            {mov.tipo === 'DEPOSITO' ? '+' : '-'}{formatCurrency(mov.monto)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Conciliacion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Total movimientos</p>
                      <p className="text-lg font-bold">{movements.length}</p>
                    </div>
                    <div className="bg-success/10 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Conciliados</p>
                      <p className="text-lg font-bold text-success">{conciliados.length}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(Math.abs(montoConciliado))}</p>
                    </div>
                    <div className="bg-destructive/10 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No conciliados</p>
                      <p className="text-lg font-bold text-destructive">{pendientes.length}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(Math.abs(montoPendiente))}</p>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No reconocidos</p>
                      <p className="text-lg font-bold text-warning">{noReconocidos.length}</p>
                    </div>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Diferencia: Saldo bancario <strong>{formatCurrency(summary?.saldo_bancario || 0)}</strong> - Conciliado{' '}
                      <strong>{formatCurrency(montoConciliado)}</strong> = <strong className={diferencia >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(diferencia)}</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button variant="secondary">
                <Download className="mr-2 h-4 w-4" />
                Ver Reporte de Conciliacion
              </Button>
              <Button variant="secondary">
                <Mail className="mr-2 h-4 w-4" />
                Enviar por email
              </Button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showVincularModal}
        onClose={() => setShowVincularModal(false)}
        title="Vincular Movimiento Bancario"
        size="lg"
      >
        {selectedMovement && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Fecha: <strong>{formatDate(selectedMovement.fecha)}</strong></p>
              <p className="text-sm text-muted-foreground">Tipo: <strong>{selectedMovement.tipo === 'DEPOSITO' ? 'Deposito' : 'Retiro'}</strong></p>
              <p className="text-sm text-muted-foreground">Monto: <strong>{formatCurrency(selectedMovement.monto)}</strong></p>
              <p className="text-sm text-muted-foreground">Referencia: <strong>{selectedMovement.referencia}</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Transaccion del sistema para vincular *</label>
              <Select
                options={[
                  { value: 'cliente', label: 'Pago de cliente' },
                  { value: 'proveedor', label: 'Pago a proveedor' },
                  { value: 'gasto', label: 'Gasto general' },
                ]}
                value={vincularTipo}
                onChange={setVincularTipo}
                placeholder="Seleccionar tipo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Referencia de transaccion *</label>
              <Input
                value={vincularRef}
                onChange={(e) => setVincularRef(e.target.value)}
                placeholder="ID de factura, compra o gasto"
              />
            </div>

            {linkError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">{linkError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowVincularModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleLinkMovement}
                disabled={linkMovement.isPending}
              >
                {linkMovement.isPending ? 'Vinculando...' : 'Vincular'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}