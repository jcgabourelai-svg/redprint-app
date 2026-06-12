import { useState } from 'react'
import { useCurrentPeriod, usePeriodHistory, useClosePeriod } from '@/hooks/useClosePeriod'
import { PeriodStatus } from '@/types/enums'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { formatCurrency } from '@/lib/utils'
import { Lock, CheckCircle, AlertTriangle, Download, Mail, FileText } from 'lucide-react'

export default function ClosePeriodPage() {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)

  const { data: periodo, isLoading, isError, refetch } = useCurrentPeriod()
  const { data: historialData } = usePeriodHistory()
  const closeMutation = useClosePeriod()

  const historial = historialData?.data ?? []

  if (isLoading) return <LoadingSpinner text="Cargando periodo..." />
  if (isError) return <ErrorMessage message="Error al cargar periodo" onRetry={() => refetch()} />
  if (!periodo) return null

  const isClosed = periodo.estado === PeriodStatus.CERRADO
  const validaciones = periodo.validaciones ?? []
  const warningsCount = validaciones.filter(v => v.estado === 'WARNING').length
  const errorsCount = validaciones.filter(v => v.estado === 'ERROR').length
  const margen = periodo.ingresos !== 0 ? ((periodo.ingresos - periodo.egresos) / periodo.ingresos * 100).toFixed(0) : '0'
  const roi = periodo.egresos !== 0 ? ((periodo.ingresos - periodo.egresos) / periodo.egresos * 100).toFixed(0) : '0'

  const handleCerrarPeriodo = () => {
    closeMutation.mutate({ periodo_id: periodo.id }, {
      onSuccess: () => {
        setShowConfirmModal(false)
        refetch()
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cierre de Periodo</h1>
        <p className="text-sm text-muted-foreground mt-1">Cierre mensual del periodo contable</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Estado del Periodo</p>
              <div className="flex items-center gap-2">
                <Badge variant={isClosed ? 'success' : 'warning'}>
                  {isClosed ? 'CERRADO' : 'ABIERTO'}
                </Badge>
                <span className="font-medium">{periodo.periodo}</span>
              </div>
              {historial.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ultimo cierre: {historial[0].periodo}
                </p>
              )}
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
          <CardTitle className="text-lg">Resumen del Periodo {isClosed ? '(Cerrado)' : 'Antes del Cierre'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Ingresos</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(periodo.ingresos)}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Egresos</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(periodo.egresos)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Rentabilidad</p>
              <p className="text-xl font-bold text-green-600">+{formatCurrency(periodo.rentabilidad)}</p>
            </div>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Facturas: <strong>{periodo.facturas_emitidas}</strong> emitidas, <strong>{periodo.facturas_pagadas}</strong> pagadas, <strong>{periodo.facturas_pendientes}</strong> pendientes</p>
            <p>Gastos: <strong>{periodo.gastos_registrados}</strong> gastos registrados</p>
            <p>Movimientos bancarios: <strong>{periodo.movimientos_bancarios}</strong> movimientos, <strong>{periodo.movimientos_conciliados}</strong> conciliados, <strong>{periodo.movimientos_pendientes}</strong> pendientes</p>
          </div>
        </CardContent>
      </Card>

      {!isClosed && validaciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Validaciones Previas al Cierre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validaciones.map((val) => (
                <div key={val.id} className="flex items-start gap-3 p-2 rounded">
                  {val.estado === 'OK' ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  ) : val.estado === 'WARNING' ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${val.estado === 'ERROR' ? 'text-destructive' : ''}`}>
                      {val.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">{val.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowReportModal(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Ver reporte preliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isClosed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reporte de Cierre - {periodo.periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Estado del Periodo: <Badge variant="success">CERRADO</Badge></p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Resumen Financiero</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Ingresos</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(periodo.ingresos)}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Egresos</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(periodo.egresos)}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Rentabilidad</p>
                    <p className="text-lg font-bold text-green-600">+{formatCurrency(periodo.rentabilidad)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="bg-muted p-2 rounded text-center text-sm">
                    <span className="text-muted-foreground">Margen: </span><strong>{margen}%</strong>
                  </div>
                  <div className="bg-muted p-2 rounded text-center text-sm">
                    <span className="text-muted-foreground">ROI: </span><strong>{roi}%</strong>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar por email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de Cierres de Periodo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {historial.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay cierres previos</p>
            )}
            {historial.map((h) => (
              <div key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{h.periodo}</span>
                    <Badge variant="success">Cerrado</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cerrado: {h.fecha_cierre ?? '-'} · Responsable: {h.cerrado_por ?? '-'}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>Ingresos: <strong>{formatCurrency(h.ingresos)}</strong></span>
                  <span>Egresos: <strong>{formatCurrency(h.egresos)}</strong></span>
                  <span className="text-green-600 font-medium">+{formatCurrency(h.rentabilidad)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Realizar Cierre de Periodo" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm">
            Estas seguro de que deseas realizar el cierre del periodo <strong>{periodo.periodo}</strong>?
          </p>

          <div className="bg-yellow-50 p-3 rounded-lg space-y-2 text-sm">
            <p className="font-medium text-yellow-800">Esta accion:</p>
            <p className="text-yellow-700">Consolidara todas las facturas y gastos del mes</p>
            <p className="text-yellow-700">Congelara los datos del periodo (no se podran editar)</p>
            <p className="text-yellow-700">Generara el reporte de rentabilidad del periodo</p>
            <p className="text-yellow-700">Actualizara las metricas del dashboard</p>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <p>Periodo: <strong>{periodo.periodo}</strong></p>
            <p>Ingresos: <strong>{formatCurrency(periodo.ingresos)}</strong></p>
            <p>Egresos: <strong>{formatCurrency(periodo.egresos)}</strong></p>
            <p>Rentabilidad: <strong className="text-green-600">+{formatCurrency(periodo.rentabilidad)}</strong></p>
          </div>

          {warningsCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
              <p className="text-yellow-800">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Hay {warningsCount} validaciones con advertencias. Deseas continuar?
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Entiendo que esta accion no se puede deshacer</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
            <Button onClick={handleCerrarPeriodo} disabled={!aceptaTerminos || closeMutation.isPending}>
              Cerrar Periodo
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title={`Reporte Preliminar - ${periodo.periodo}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(periodo.ingresos)}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Egresos</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(periodo.egresos)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Rentabilidad</p>
              <p className="text-lg font-bold text-green-600">+{formatCurrency(periodo.rentabilidad)}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Margen: <strong>{margen}%</strong> · ROI: <strong>{roi}%</strong></p>
            <p>Facturas emitidas: {periodo.facturas_emitidas} · Pagadas: {periodo.facturas_pagadas} · Pendientes: {periodo.facturas_pendientes}</p>
            <p>Gastos registrados: {periodo.gastos_registrados}</p>
            <p>Movimientos bancarios: {periodo.movimientos_bancarios} · Conciliados: {periodo.movimientos_conciliados} · Pendientes: {periodo.movimientos_pendientes}</p>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowReportModal(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
