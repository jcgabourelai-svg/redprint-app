import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import api, { apiErrorMessage } from '../lib/api'
import { todayISO } from '../lib/format'
import type { ClientOption, TipoVisita, Visit } from '../types/api'
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
  TextArea,
  TextInput,
} from '../components/ui'

const TIPO_VISITA_OPCIONES: { value: TipoVisita; label: string; requiereContrato: boolean }[] = [
  { value: 'LECTURA', label: 'Lectura de contador', requiereContrato: true },
  { value: 'INSTALACION', label: 'Instalación de impresora', requiereContrato: true },
  { value: 'RETIRO', label: 'Retiro de impresora', requiereContrato: true },
  { value: 'ENTREGA_INSUMOS', label: 'Entrega de insumos', requiereContrato: true },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento', requiereContrato: false },
]

export default function NewVisitPage() {
  const navigate = useNavigate()
  const goBackTo = useGoBack()
  const { user, hasPermission } = useAuth()
  const online = useOnline()

  const canCreate = hasPermission('operaciones.calendario')

  const [clientes, setClientes] = useState<ClientOption[] | null>(null)
  const [clientesError, setClientesError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [contratoId, setContratoId] = useState<number | null>(null)
  const [tipoVisita, setTipoVisita] = useState<TipoVisita>('LECTURA')
  const [fechaProgramada, setFechaProgramada] = useState(todayISO())
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!canCreate) return
    let cancelled = false
    api
      .get<ClientOption[]>('/visits/clientes')
      .then((res) => {
        if (!cancelled) {
          setClientes(Array.isArray(res.data) ? res.data : [])
          setClientesError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setClientesError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canCreate])

  const clienteSeleccionado = useMemo(
    () => clientes?.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId]
  )

  const filtrados = useMemo(() => {
    if (!clientes) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        c.contratos.some((ct) => ct.codigo_negocio.toLowerCase().includes(q))
    )
  }, [clientes, busqueda])

  const opcionTipo = TIPO_VISITA_OPCIONES.find((o) => o.value === tipoVisita)
  const requiereContrato = opcionTipo?.requiereContrato ?? true

  function seleccionarCliente(c: ClientOption) {
    setClienteId(c.id)
    setContratoId(c.contratos[0]?.id ?? null)
  }

  const puedeEnviar =
    clienteId !== null &&
    (!requiereContrato || contratoId !== null) &&
    fechaProgramada !== '' &&
    !submitting &&
    online

  async function handleSubmit() {
    if (!user || !puedeEnviar) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.post<Visit>('/visits', {
        cliente_id: clienteId,
        contrato_id: requiereContrato ? contratoId : contratoId ?? undefined,
        tipo_visita: tipoVisita,
        fecha_programada: fechaProgramada,
        socio_id: user.id,
        notas: notas.trim() || undefined,
        origen: 'CAMPO',
      })
      const creado = res.data?.id ?? (res.data as unknown as { data?: Visit })?.data?.id
      if (creado) {
        navigate(`/visita/${creado}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Nueva visita" onBack={() => goBackTo('/')} />
      <Page>
        {!canCreate && (
          <Banner tone="error">
            No tienes permiso para crear visitas (se requiere el permiso del calendario de
            operaciones).
          </Banner>
        )}
        {!online && canCreate && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. La creación de visitas requiere conexión a internet.
            </Banner>
          </div>
        )}

        {canCreate && (
          <>
            <SectionTitle hint="Solo clientes con contrato activo pueden recibir visitas de campo">
              Cliente
            </SectionTitle>

            {clientesError && (
              <div className="mb-4">
                <Banner tone="error">{clientesError}</Banner>
              </div>
            )}

            {clientes === null && !clientesError && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {clientes !== null && (
              <>
                {clienteSeleccionado ? (
                  <Card className="mb-3 !border-blue-500 ring-1 ring-blue-500">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-800">
                          {clienteSeleccionado.razon_social}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {clienteSeleccionado.contratos.length} contrato(s) activo(s)
                        </p>
                      </div>
                      <button
                        aria-label="Cambiar cliente"
                        className="text-sm font-semibold text-blue-600"
                        onClick={() => {
                          setClienteId(null)
                          setContratoId(null)
                          setBusqueda('')
                        }}
                      >
                        Cambiar
                      </button>
                    </div>
                  </Card>
                ) : (
                  <>
                    <div className="mb-3">
                      <TextInput
                        type="search"
                        placeholder="Buscar cliente o contrato..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                      />
                    </div>
                    {filtrados.length === 0 && (
                      <EmptyState
                        icon="🏢"
                        text="No hay clientes con contrato activo que coincidan con la búsqueda"
                      />
                    )}
                    {filtrados.map((c) => (
                      <Card
                        key={c.id}
                        className="mb-3"
                        onClick={() => seleccionarCliente(c)}
                      >
                        <p className="truncate font-semibold text-gray-800">{c.razon_social}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {c.contratos.map((ct) => ct.codigo_negocio).join(' · ')}
                        </p>
                      </Card>
                    ))}
                  </>
                )}

                {clienteSeleccionado && (
                  <div className="mt-4">
                    <Field
                      label="Contrato"
                      help="Los flujos de campo (lectura, instalación, retiro, insumos) operan sobre las impresoras del contrato"
                    >
                      {clienteSeleccionado.contratos.length === 1 ? (
                        <Card className="!border-blue-500 ring-1 ring-blue-500">
                          <p className="font-semibold text-gray-800">
                            {clienteSeleccionado.contratos[0].codigo_negocio}
                          </p>
                        </Card>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {clienteSeleccionado.contratos.map((ct) => (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => setContratoId(ct.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                contratoId === ct.id
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                              }`}
                            >
                              {ct.codigo_negocio}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                <div className="mt-2">
                  <Field label="Tipo de visita">
                    <select
                      value={tipoVisita}
                      onChange={(e) => setTipoVisita(e.target.value as TipoVisita)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {TIPO_VISITA_OPCIONES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Fecha programada">
                    <TextInput
                      type="date"
                      value={fechaProgramada}
                      onChange={(e) => setFechaProgramada(e.target.value)}
                    />
                  </Field>
                  <Field label="Notas" help="Opcional">
                    <TextArea
                      rows={3}
                      placeholder="Observaciones adicionales"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                    />
                  </Field>
                </div>

                {submitError && (
                  <div className="mb-4">
                    <Banner tone="error">{submitError}</Banner>
                  </div>
                )}

                <Button
                  block
                  disabled={!puedeEnviar}
                  loading={submitting}
                  onClick={() => void handleSubmit()}
                >
                  Crear visita
                </Button>
              </>
            )}
          </>
        )}
      </Page>
    </div>
  )
}
