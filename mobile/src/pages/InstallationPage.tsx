import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { formatDayLabel } from '../lib/format'
import { MOTIVO_LIBERACION_LABEL } from '../lib/motivosLiberacion'
import PrinterColorDot from '../components/PrinterColorDot'
import type { ContractAssignment, ContractPlanInfo, ContractPlanRow, Printer, Visit } from '../types/api'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
  TextInput,
} from '../components/ui'

/** Ordena: primero las series cuyo modelo está en el plan (sort estable). */
function ordenarPorPlan(printers: Printer[], planModelIds: Set<number>): Printer[] {
  const porMarcaModelo = (a: Printer, b: Printer) =>
    `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es')
  return printers
    .slice()
    .sort((a, b) => {
      const aEnPlan = a.printer_model_id ? planModelIds.has(a.printer_model_id) : false
      const bEnPlan = b.printer_model_id ? planModelIds.has(b.printer_model_id) : false
      if (aEnPlan !== bEnPlan) return aEnPlan ? -1 : 1
      return porMarcaModelo(a, b)
    })
}

/** Sustitución pendiente en esta visita: liberación por falla aún sin reemplazo. */
function sustitucionPendiente(
  cambios: Visit['cambios_impresoras']
): { assignmentId: number; serie: string | null; alias: string | null; color: string | null } | null {
  if (!cambios || cambios.length === 0) return null

  const liberaciones = cambios.filter(
    (c) => c.evento === 'LIBERACION_CONTRATO' && c.motivo_liberacion === 'SUSTITUCION_FALLA'
  )
  const asignaciones = cambios.filter((c) => c.evento === 'ASIGNACION_CONTRATO')

  for (let i = liberaciones.length - 1; i >= 0; i--) {
    const l = liberaciones[i]
    if (l.assignment_id == null) continue
    const yaReemplazada = asignaciones.some((a) => a.reemplaza_a === l.assignment_id)
    if (!yaReemplazada) {
      return {
        assignmentId: l.assignment_id,
        serie: l.impresora?.num_serie ?? null,
        alias: l.alias ?? null,
        color: l.color ?? null,
      }
    }
  }
  return null
}

/** Asignación liberada aún sin reemplazo: candidata a sustitución diferida. */
function esPendiente(pa: ContractAssignment): boolean {
  return pa.activa === false && !pa.reemplazada_por_id
}

export default function InstallationPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canInstall =
    hasPermission('contratos') && hasPermission('inventario.impresoras')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [printers, setPrinters] = useState<Printer[] | null>(null)
  const [printersError, setPrintersError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ContractPlanRow[] | null>(null)
  const [assignments, setAssignments] = useState<ContractAssignment[] | null>(null)
  const [assignmentsVisitId, setAssignmentsVisitId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lecturaInicial, setLecturaInicial] = useState('0')
  const [alias, setAlias] = useState('')
  const [aliasSugerido, setAliasSugerido] = useState<string | null>(null)
  const [colorHeredado, setColorHeredado] = useState<string | null>(null)
  const [reemplazaA, setReemplazaA] = useState<number | null>(null)
  const [modoInstalacion, setModoInstalacion] = useState<'sustitucion' | 'nueva' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingVisit(true)
    api
      .get<Visit>(`/visits/${visitId}`)
      .then((res) => {
        if (!cancelled) {
          setVisit(res.data)
          setVisitError(null)
          // Sustitución en esta visita: la liberación por falla aún sin
          // reemplazo enlaza esta instalación con el puesto liberado
          // (alias/color heredados server-side vía reemplaza_a).
          const pendiente = sustitucionPendiente(res.data.cambios_impresoras)
          if (pendiente) {
            setModoInstalacion('sustitucion')
            setReemplazaA(pendiente.assignmentId)
            if (pendiente.alias) {
              setAliasSugerido(pendiente.alias)
              setAlias((actual) => actual || pendiente.alias || '')
            }
            if (pendiente.color) {
              setColorHeredado(pendiente.color)
            }
          } else {
            setModoInstalacion(null)
            setReemplazaA(null)
            setAliasSugerido(null)
            setColorHeredado(null)
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setVisitError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoadingVisit(false)
      })
    return () => {
      cancelled = true
    }
  }, [visitId])

  const contratoId = visit?.contrato_id ?? null

  // Contrato: plan (intención comercial, solo informativo) y asignaciones,
  // de donde salen las sustituciones pendientes de cualquier fecha.
  useEffect(() => {
    if (!contratoId) return
    let cancelled = false
    api
      .get<ContractPlanInfo>(`/contracts/${contratoId}`)
      .then((res) => {
        if (!cancelled) {
          setPlan(res.data.plan_impresoras ?? [])
          setAssignments(res.data.impresoras ?? [])
          setAssignmentsVisitId(visitId)
        }
      })
      .catch(() => {
        // El plan es enriquecimiento: nunca bloquea la instalación. Sin
        // asignaciones el selector queda oculto y el enlace auto-detectado
        // de misma visita (si existe) se conserva.
        if (!cancelled) setPlan([])
      })
    return () => {
      cancelled = true
    }
  }, [contratoId, visitId])

  // Coherencia visit↔contrato: valida el enlace auto-detectado contra las
  // pendientes reales del contrato y aplica el fallback de rotación solo
  // cuando no hay pendientes (con selector visible, este lo sustituye).
  useEffect(() => {
    if (assignments === null || visit === null || assignmentsVisitId !== visit.id) return
    const pendientesActuales = assignments.filter(esPendiente)
    if (reemplazaA !== null) {
      if (!pendientesActuales.some((pa) => pa.id === reemplazaA)) {
        // El evento de la visita quedó obsoleto: la fila ya fue reemplazada
        // por otra instalación. Se vuelve a pedir la elección al operador.
        setModoInstalacion(null)
        setReemplazaA(null)
        setAliasSugerido(null)
        setColorHeredado(null)
      }
      return
    }
    if (pendientesActuales.length === 0) {
      // Rotación de flota (fallback best-effort, sin enlace).
      const cambios = visit.cambios_impresoras
      const liberacion = cambios?.find((c) => c.evento === 'LIBERACION_CONTRATO' && c.alias)
      if (liberacion?.alias) {
        setAliasSugerido(liberacion.alias)
        setAlias((actual) => actual || liberacion.alias || '')
      }
      setColorHeredado(
        cambios?.find((c) => c.evento === 'LIBERACION_CONTRATO' && c.color)?.color ?? null
      )
    }
  }, [assignments, assignmentsVisitId, visit, reemplazaA])

  useEffect(() => {
    if (!canInstall || !contratoId || plan === null) return
    let cancelled = false
    fetchAll<Printer>('/printers', { estado: 'EN_ALMACEN' })
      .then((ps) => {
        if (!cancelled) {
          const planModelIds = new Set(
            (plan ?? []).map((row) => row.modelo_id)
          )
          setPrinters(planModelIds.size > 0 ? ordenarPorPlan(ps, planModelIds) : ps)
          setPrintersError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setPrintersError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canInstall, contratoId, plan])

  async function handleSubmit() {
    if (!contratoId || selectedId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/contracts/${contratoId}/assign-printer`, {
        impresora_id: selectedId,
        lectura_inicial: Number.parseInt(lecturaInicial || '0', 10) || 0,
        visita_id: visitId,
        alias: alias.trim() || null,
        color: colorHeredado,
        reemplaza_a: modoInstalacion === 'sustitucion' ? reemplazaA : null,
      })
      toast.success('Impresora asignada al contrato')
      goBackTo(`/visita/${visitId}`)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Instalación') : 'Instalación'

  const planModelIds = new Set((plan ?? []).map((row) => row.modelo_id))
  const pendientes = (assignments ?? [])
    .filter(esPendiente)
    .slice()
    .sort((a, b) => (b.fecha_liberacion ?? '').localeCompare(a.fecha_liberacion ?? ''))
  const sustitucionSeleccionada =
    reemplazaA !== null ? (pendientes.find((pa) => pa.id === reemplazaA) ?? null) : null
  const enlaceVisita =
    reemplazaA !== null
      ? (visit?.cambios_impresoras?.find((c) => c.assignment_id === reemplazaA) ?? null)
      : null
  const sustitucionSerie =
    sustitucionSeleccionada?.impresora_serie ?? enlaceVisita?.impresora?.num_serie ?? null
  const sustitucionAlias = sustitucionSeleccionada?.alias ?? enlaceVisita?.alias ?? null

  const eleccionPendiente =
    assignments !== null &&
    pendientes.length > 0 &&
    (modoInstalacion === null || (modoInstalacion === 'sustitucion' && reemplazaA === null))

  const handleSelect = (p: Printer) => {
    setSelectedId(p.id)
    // D-D: la línea base sugerida es el contador físico de la serie elegida;
    // el operador puede ajustarla antes de confirmar.
    setLecturaInicial(String(p.contador_actual ?? 0))
  }

  const handlePendienteSelect = (pa: ContractAssignment) => {
    setReemplazaA(pa.id)
    setAliasSugerido(pa.alias ?? null)
    setAlias((actual) => actual || pa.alias || '')
    setColorHeredado(pa.color ?? null)
  }

  const handleModoSelect = (modo: 'sustitucion' | 'nueva') => {
    setModoInstalacion(modo)
    if (modo === 'nueva') {
      setReemplazaA(null)
      // El alias auto-heredado no aplica a un equipo adicional: solo se
      // conserva lo que el operador tecleó por su cuenta.
      setAlias((actual) => (aliasSugerido !== null && actual === aliasSugerido ? '' : actual))
      setAliasSugerido(null)
      setColorHeredado(null)
      return
    }
    if (reemplazaA === null && pendientes.length === 1) {
      handlePendienteSelect(pendientes[0])
    }
  }

  return (
    <div>
      <PageHeader title={title} onBack={() => goBackTo(`/visita/${visitId}`)} />
      <Page>
        {!canInstall && (
          <Banner tone="error">
            No tienes permiso para instalar impresoras (se requieren permisos de contratos e
            inventario).
          </Banner>
        )}
        {!online && canInstall && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. La instalación requiere conexión a internet.
            </Banner>
          </div>
        )}

        {loadingVisit && <SkeletonCard />}

        {visitError && (
          <div className="mb-4">
            <Banner tone="error">{visitError}</Banner>
          </div>
        )}

        {visit && !contratoId && (
          <div className="mb-4">
            <Banner tone="warn">
              Esta visita no tiene contrato asociado. No se puede instalar una impresora.
            </Banner>
          </div>
        )}

        {canInstall && contratoId && (
          <>
            {reemplazaA !== null && (
              <div className="mb-4">
                <Banner tone="info">
                  <span className="font-semibold">Sustitución de equipo:</span> esta instalación
                  reemplaza
                  {sustitucionSerie ? ` a la serie ${sustitucionSerie}` : ' al equipo retirado'}
                  {sustitucionAlias ? ` (${sustitucionAlias})` : ''}. Se heredarán el alias y el
                  color del puesto.
                </Banner>
              </div>
            )}

            {(plan?.length ?? 0) > 0 && (
              <div className="mb-4">
                <Banner tone="info">
                  <span className="font-semibold">Plan del contrato:</span>{' '}
                  {plan!
                    .map(
                      (row) =>
                        `${row.cantidad}× ${row.marca ?? ''} ${row.modelo_nombre ?? ''}`.trim()
                    )
                    .join(' · ')}
                  {' · '}
                  Instaladas: {plan!.reduce((s, row) => s + (row.instaladas ?? 0), 0)}
                </Banner>
              </div>
            )}

            {assignments !== null && pendientes.length > 0 && (
              <div className="mb-4">
                <SectionTitle hint="El enlace hereda el alias y el color del puesto">
                  ¿Esta instalación reemplaza un equipo retirado?
                </SectionTitle>
                <Card
                  className={`mb-3 ${modoInstalacion === 'sustitucion' ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                  onClick={() => handleModoSelect('sustitucion')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">🔁 Sustituye a un equipo retirado</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Hereda el alias y el color del puesto que reemplaza
                      </p>
                    </div>
                    {modoInstalacion === 'sustitucion' && <span className="text-blue-600">✓</span>}
                  </div>
                </Card>
                <Card
                  className={`mb-3 ${modoInstalacion === 'nueva' ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                  onClick={() => handleModoSelect('nueva')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">
                        ➕ Equipo adicional (asignación nueva)
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">Amplía la flota del contrato</p>
                    </div>
                    {modoInstalacion === 'nueva' && <span className="text-blue-600">✓</span>}
                  </div>
                </Card>
                {modoInstalacion === 'sustitucion' && (
                  <div>
                    {reemplazaA === null && (
                      <p className="mb-2 text-xs font-medium text-gray-500">
                        Selecciona qué puesto reemplaza
                      </p>
                    )}
                    {pendientes.map((pa) => (
                      <Card
                        key={pa.id}
                        className={`mb-3 ${reemplazaA === pa.id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                        onClick={() => handlePendienteSelect(pa)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-semibold text-gray-800">
                              {pa.color && <PrinterColorDot color={pa.color} />}
                              {pa.alias ||
                                `${pa.impresora_marca ?? ''} ${pa.impresora_modelo ?? ''}`.trim() ||
                                'Equipo retirado'}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              Serie: {pa.impresora_serie ?? '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Liberada{' '}
                              {pa.fecha_liberacion ? formatDayLabel(pa.fecha_liberacion) : '-'}
                              {pa.motivo_liberacion &&
                                ` · ${MOTIVO_LIBERACION_LABEL[pa.motivo_liberacion] ?? pa.motivo_liberacion}`}
                            </p>
                          </div>
                          {reemplazaA === pa.id && <span className="text-blue-600">✓</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                {modoInstalacion === 'nueva' && (
                  <Card className="!border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600">
                      Se instalará como equipo adicional. Los puestos liberados seguirán pendientes
                      de reemplazo.
                    </p>
                  </Card>
                )}
              </div>
            )}

            <SectionTitle hint="Selecciona una impresora disponible en almacén">
              Impresoras en almacén
            </SectionTitle>

            {printersError && (
              <div className="mb-4">
                <Banner tone="error">{printersError}</Banner>
              </div>
            )}

            {printers === null && !printersError && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {printers !== null && printers.length === 0 && (
              <EmptyState icon="🖨️" text="No hay impresoras disponibles para instalación" />
            )}

            {printers?.map((p) => {
              const enPlan = p.printer_model_id ? planModelIds.has(p.printer_model_id) : false
              return (
                <Card
                  key={p.id}
                  className={`mb-3 ${selectedId === p.id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                  onClick={() => handleSelect(p)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-800">
                        {p.marca} {p.modelo}
                        {enPlan && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            EN PLAN
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">Serie: {p.num_serie ?? '-'}</p>
                      <p className="text-xs text-gray-500">
                        Inventario: {p.num_inventario ?? '-'}
                        {p.warehouse ? ` · ${p.warehouse.nombre}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">Contador: {p.contador_actual}</p>
                    </div>
                    {selectedId === p.id && <span className="text-blue-600">✓</span>}
                  </div>
                </Card>
              )
            })}

            {selectedId !== null && (
              <div className="mt-5 space-y-4">
                <Field label="Lectura inicial" help="Valor del contador al momento de la instalación">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={lecturaInicial}
                    onChange={(e) => setLecturaInicial(e.target.value)}
                  />
                </Field>
                <Field
                  label="Alias / ubicación (opcional)"
                  help={
                    aliasSugerido && alias === aliasSugerido
                      ? `Heredado del puesto reemplazado (${aliasSugerido}); edítalo si cambia el puesto`
                      : 'Cómo la identifica el cliente en el sitio. Ej. Recepción'
                  }
                >
                  <TextInput
                    type="text"
                    value={alias}
                    maxLength={60}
                    placeholder="Ej. Recepción"
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {submitError && (
              <div className="mb-4">
                <Banner tone="error">{submitError}</Banner>
              </div>
            )}

            {eleccionPendiente && selectedId !== null && (
              <p className="mt-3 text-center text-xs text-gray-500">
                Elige si esta instalación reemplaza un equipo retirado o es un equipo adicional
                para continuar.
              </p>
            )}
            <Button
              block
              className="mt-4"
              disabled={selectedId === null || !online || submitting || eleccionPendiente}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Confirmar instalación
            </Button>
          </>
        )}
      </Page>
    </div>
  )
}
