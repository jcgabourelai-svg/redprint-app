import { useState } from 'react'
import { useReconciliationMovements, useLinkMovement, useReconciliationSummary } from '@/hooks/useReconciliation'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, Link2, Download, Mail } from 'lucide-react'
import type { BankMovement } from '@/types/models'

export default function ReconciliationPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0)
  const [periodo, setPeriodo] = useState('mayo-2026')
  const [showVincularModal, setShowVincularModal] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<BankMovement | null>(null)
  const [vincularTipo, setVincularTipo] = useState('cliente')
  const [vincularRef, setVincularRef] = useState('')

  const { data: accountsData } = useBankAccounts()
  const { data: movementsData, isLoading, isError, refetch } = useReconciliationMovements(selectedAccountId, periodo)
  const { data: summaryData } = useReconciliationSummary(selectedAccountId, periodo)
  const linkMutation = useLinkMovement()

  const accounts = accountsData?.data ?? []
  const movements = movementsData?.data ?? []
  const summary = summaryData as Record<string, unknown> | undefined

  const conciliados = movements.filter(m => m.conciliacion_status === 'CONCILIADO')
  const pendientes = movements.filter(m => m.conciliacion_status === 'PENDIENTE')

  const handleVincular = (mov: BankMovement) => {
    setSelectedMovement(mov)
    setVincularTipo('cliente')
    setVincularRef('')
    setShowVincularModal(true)
  }

  const handleLinkSubmit = () => {
    if (!selectedMovement) return
    linkMutation.mutate({
      movement_id: selectedMovement.id,
      tipo: vincularTipo,
      referencia: vincularRef,
    }, {
      onSuccess: () => {
        setShowVincularModal(false)
        refetch()
      },
    })
  }

  const periodOptions = [
    { value: 'mayo-2026', label: 'Mayo 2026' },
    { value: 'abril-2026', label: 'Abril 2026' },
    { value: 'marzo-2026', label: 'Marzo 2026' },
  ]

  const accountOptions = [
    { value: '', label: '-- Seleccionar cuenta --' },
    ...accounts.map(a => ({ value: String(a.id), label: `${a.banco} - ${a.numero_cuenta}` })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conciliacion Bancaria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Concilia movimientos bancarios con transacciones del sistema
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <Select
          label="Cuenta"
          options={accountOptions}
          value={String(selectedAccountId)}
          onChange={(e) => setSelectedAccountId(Number(e.target.value))}
        />
        <Select
          label="Periodo"
          options={periodOptions}
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        />
      </div>

      {selectedAccountId > 0 && (
        <>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm">
                Estado de Conciliacion: <strong>{conciliados.length} movimientos conciliados</strong>,
                {' '}{pendientes.length} movimientos pendientes de conciliar
              </p>
            </CardContent>
          </Card>

          {isLoading && <LoadingSpinner text="Cargando movimientos..." />}
          {isError && <ErrorMessage message="Error al cargar movimientos" onRetry={() => refetch()} />}

          {!isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movimientos Bancarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {movements.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">No hay movimientos</p>
                    )}
                    {movements.slice(0, 10).map((mov) => (
                      <div key={mov.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className={`rounded-full p-2 ${mov.tipo === 'DEPOSITO' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {mov.tipo === 'DEPOSITO' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{mov.descripcion}</span>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(mov.fecha)} · Ref: {mov.referencia}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${mov.tipo === 'DEPOSITO' ? 'text-green-600' : 'text-red-600'}`}>
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
                        {mov.conciliacion_status !== 'CONCILIADO' && (
                          <button
                            onClick={() => handleVincular(mov)}
                            className="p-1 hover:bg-accent rounded"
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
                  <CardTitle className="text-lg">Transacciones del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {conciliados.slice(0, 10).map((mov) => (
                      <div key={mov.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className={`rounded-full p-2 ${mov.tipo === 'DEPOSITO' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {mov.tipo === 'DEPOSITO' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{mov.descripcion}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(mov.fecha)}</p>
                        </div>
                        <span className={`text-sm font-medium ${mov.tipo === 'DEPOSITO' ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.tipo === 'DEPOSITO' ? '+' : '-'}{formatCurrency(mov.monto)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen de Conciliacion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Total movimientos</p>
                      <p className="text-lg font-bold">{movements.length}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">Conciliados</p>
                      <p className="text-lg font-bold text-green-600">{conciliados.length}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No conciliados</p>
                      <p className="text-lg font-bold text-red-600">{pendientes.length}</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No reconocidos</p>
                      <p className="text-lg font-bold text-yellow-600">
                        {movements.filter(m => m.conciliacion_status === 'NO_RECONOCIDO').length}
                      </p>
                    </div>
                  </div>

                  {summary.saldo_bancario != null && summary.saldo_conciliado != null && (
                    <div className="bg-muted p-3 rounded-lg text-sm">
                      <p>
                        Diferencia: Saldo bancario <strong>{formatCurrency(summary.saldo_bancario as number)}</strong> - Conciliado{' '}
                        <strong>{formatCurrency(summary.saldo_conciliado as number)}</strong> ={' '}
                        <strong className={(summary.saldo_bancario as number) - (summary.saldo_conciliado as number) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency((summary.saldo_bancario as number) - (summary.saldo_conciliado as number))}
                        </strong>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Ver Reporte de Conciliacion
            </Button>
            <Button variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Enviar por email
            </Button>
          </div>
        </>
      )}

      <Modal isOpen={showVincularModal} onClose={() => setShowVincularModal(false)} title="Vincular Movimiento Bancario">
        {selectedMovement && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <p>Fecha: <strong>{formatDate(selectedMovement.fecha)}</strong></p>
              <p>Tipo: <strong>{selectedMovement.tipo === 'DEPOSITO' ? 'Deposito' : 'Retiro'}</strong></p>
              <p>Monto: <strong>{formatCurrency(selectedMovement.monto)}</strong></p>
              <p>Referencia: <strong>{selectedMovement.referencia}</strong></p>
            </div>

            <Select
              label="Transaccion del sistema para vincular *"
              options={[
                { value: 'cliente', label: 'Pago de cliente' },
                { value: 'proveedor', label: 'Pago a proveedor' },
                { value: 'gasto', label: 'Gasto general' },
              ]}
              value={vincularTipo}
              onChange={(e) => { setVincularTipo(e.target.value); setVincularRef('') }}
            />

            {vincularTipo === 'cliente' && (
              <Select
                label="Factura"
                options={[
                  { value: '', label: '-- Seleccionar factura --' },
                  { value: 'F-001', label: 'F-001' },
                  { value: 'F-002', label: 'F-002' },
                  { value: 'F-003', label: 'F-003' },
                ]}
                value={vincularRef}
                onChange={(e) => setVincularRef(e.target.value)}
              />
            )}

            {vincularTipo === 'proveedor' && (
              <Select
                label="Compra"
                options={[
                  { value: '', label: '-- Seleccionar compra --' },
                  { value: 'CMP-001', label: 'CMP-001' },
                  { value: 'CMP-002', label: 'CMP-002' },
                ]}
                value={vincularRef}
                onChange={(e) => setVincularRef(e.target.value)}
              />
            )}

            {vincularTipo === 'gasto' && (
              <Select
                label="Categoria"
                options={[
                  { value: '', label: '-- Seleccionar categoria --' },
                  { value: 'suministros', label: 'Suministros' },
                  { value: 'servicios', label: 'Servicios' },
                  { value: 'transporte', label: 'Transporte' },
                ]}
                value={vincularRef}
                onChange={(e) => setVincularRef(e.target.value)}
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowVincularModal(false)}>Cancelar</Button>
              <Button onClick={handleLinkSubmit} disabled={linkMutation.isPending || !vincularRef}>Vincular</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
