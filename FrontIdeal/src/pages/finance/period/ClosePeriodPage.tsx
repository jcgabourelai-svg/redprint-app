import { useState } from 'react'
import { Lock, CheckCircle, AlertTriangle, TrendingUp, Download, Mail, FileText } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { useCurrentPeriod, usePeriodHistory, useClosePeriod } from '@/hooks/useClosePeriod'
import type { PeriodClose, PeriodValidation } from '@/types/period-close'
import { parseApiError } from '@/lib/api-errors'

export default function ClosePeriodPage() {
  const [periodo] = useState<PeriodClose | null>(null)
  const [historial] = useState<PeriodClose[]>([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showValidacionesModal, setShowValidacionesModal] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [closeError, setCloseError] = useState('')

  const { data: currentPeriodData, isLoading } = useCurrentPeriod()
  const { data: historyData } = usePeriodHistory()
  const closePeriodMutation = useClosePeriod()

  const currentPeriod = currentPeriodData || periodo
  const periodHistory = historyData?.data || []

  const margen = currentPeriod ? ((currentPeriod.ingresos - currentPeriod.egresos) / currentPeriod.ingresos * 100).toFixed(0) : '0'
  const roi = currentPeriod ? ((currentPeriod.ingresos - currentPeriod.egresos) / currentPeriod.egresos * 100).toFixed(0) : '0'

  const warningsCount = currentPeriod?.validaciones.filter(v => v.estado === 'warning').length || 0
  const errorsCount = currentPeriod?.validaciones.filter(v => v.estado === 'error').length || 0

  const handleCerrarPeriodo = async () => {
    setCloseError('')
    try {
      await closePeriodMutation.mutateAsync({})
      setIsClosed(true)
      setShowConfirmModal(false)
    } catch (err) {
      setCloseError(parseApiError(err))
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Finanzas" showSearch>
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando periodo actual...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cierre de Periodo</h2>
            <p className="text-sm text-gray-500">Cierre mensual del periodo contable</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Estado del Periodo</p>
                <div className="flex items-center gap-2">
                  <Badge variant={isClosed ? 'success' : 'warning'}>
                    {isClosed ? 'CERRADO' : 'ABIERTO'}
                  </Badge>
                  <span className="font-medium">{currentPeriod?.periodo || 'Cargando...'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Ultimo cierre: {periodHistory[0]?.periodo || 'No registrado'}</p>
              </div>
              {!isClosed && (
                <Button onClick={() => setShowConfirmModal(true)} disabled={errorsCount > 0}>
                  <Lock className="mr-2 h-4 w-4" />
                  Realizar Cierre del Periodo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen del Periodo {isClosed ? '(Cerrado)' : 'Antes del Cierre'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">Ingresos</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(currentPeriod?.ingresos || 0)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">Egresos</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(currentPeriod?.egresos || 0)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">Rentabilidad</p>
                <p className="text-xl font-bold text-green-600">+{formatCurrency(currentPeriod?.rentabilidad || 0)}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p>Facturas: <strong>{currentPeriod?.facturas_emitidas}</strong> emitidas, <strong>{currentPeriod?.facturas_pagadas}</strong> pagadas, <strong>{currentPeriod?.facturas_pendientes}</strong> pendientes</p>
              <p>Gastos: <strong>{currentPeriod?.gastos_registrados}</strong> gastos registrados</p>
              <p>Movimientos bancarios: <strong>{currentPeriod?.movimientos_bancarios}</strong> movimientos, <strong>{currentPeriod?.movimientos_conciliados}</strong> conciliados, <strong>{currentPeriod?.movimientos_pendientes}</strong> pendientes</p>
            </div>
          </CardContent>
        </Card>

        {!isClosed && currentPeriod && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Validaciones Previas al Cierre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentPeriod.validaciones.map((val) => (
                  <div key={val.id} className="flex items-start gap-3 p-2 rounded">
                    {val.estado === 'ok' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : val.estado === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${val.estado === 'error' ? 'text-red-600' : ''}`}>
                        {val.nombre}
                      </p>
                      <p className="text-xs text-gray-500">{val.mensaje}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowValidacionesModal(true)}>
                  Revisar validaciones
                </Button>
                <Button variant="secondary" onClick={() => setShowReportModal(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Ver reporte preliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Historial de Cierres de Periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {periodHistory.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{h.periodo}</span>
                      <Badge variant="success">Cerrado</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Cerrado: {h.fecha_cierre} · Responsable: {h.cerrado_por}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-4 text-sm">
                      <span>Ingresos: <strong>{formatCurrency(h.ingresos)}</strong></span>
                      <span>Egresos: <strong>{formatCurrency(h.egresos)}</strong></span>
                      <span className="text-green-600 font-medium">+{formatCurrency(h.rentabilidad)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Realizar Cierre de Periodo"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700">
              Estas seguro de que deseas realizar el cierre del periodo <strong>{currentPeriod?.periodo}</strong>?
            </p>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg space-y-2 text-sm">
            <p className="font-medium text-yellow-800">Esta accion:</p>
            <p className="text-yellow-700">Consolidara todas las facturas y gastos del mes</p>
            <p className="text-yellow-700">Congelara los datos del periodo (no se podran editar)</p>
            <p className="text-yellow-700">Generara el reporte de rentabilidad del periodo</p>
            <p className="text-yellow-700">Actualizara las metricas del dashboard</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
            <p>Periodo: <strong>{currentPeriod?.periodo}</strong></p>
            <p>Ingresos: <strong>{formatCurrency(currentPeriod?.ingresos || 0)}</strong></p>
            <p>Egresos: <strong>{formatCurrency(currentPeriod?.egresos || 0)}</strong></p>
            <p>Rentabilidad: <strong className="text-green-600">+{formatCurrency(currentPeriod?.rentabilidad || 0)}</strong></p>
          </div>

          {warningsCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
              <p className="text-yellow-800">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Hay {warningsCount} movimientos bancarios pendientes de conciliar. Deseas continuar?
              </p>
            </div>
          )}

          {closeError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{closeError}</p>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Entiendo que esta accion no se puede deshacer</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCerrarPeriodo}
              disabled={!aceptaTerminos || closePeriodMutation.isPending}
            >
              {closePeriodMutation.isPending ? 'Cerrando...' : 'Cerrar Periodo'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Reporte Preliminar - {currentPeriod?.periodo}"
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Ingresos</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(currentPeriod?.ingresos || 0)}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Egresos</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(currentPeriod?.egresos || 0)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Rentabilidad</p>
              <p className="text-lg font-bold text-green-600">+{formatCurrency(currentPeriod?.rentabilidad || 0)}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Margen: <strong>{margen}%</strong> · ROI: <strong>{roi}%</strong></p>
            <p>Facturas emitidas: {currentPeriod?.facturas_emitidas} · Pagadas: {currentPeriod?.facturas_pagadas} · Pendientes: {currentPeriod?.facturas_pendientes}</p>
            <p>Gastos registrados: {currentPeriod?.gastos_registrados}</p>
            <p>Movimientos bancarios: {currentPeriod?.movimientos_bancarios} · Conciliados: {currentPeriod?.movimientos_conciliados} · Pendientes: {currentPeriod?.movimientos_pendientes}</p>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowReportModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showValidacionesModal}
        onClose={() => setShowValidacionesModal(false)}
        title="Validaciones Previas al Cierre"
        size="lg"
      >
        <div className="space-y-3">
          {currentPeriod?.validaciones.map((val) => (
            <div key={val.id} className="flex items-start gap-3 p-3 border rounded-lg">
              {val.estado === 'ok' ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : val.estado === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{val.nombre}</p>
                <p className="text-xs text-gray-500">{val.mensaje}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowValidacionesModal(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}