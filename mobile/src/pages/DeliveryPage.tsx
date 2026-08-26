import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { Article, Visit } from '../types/api'
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

export default function DeliveryPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canDeliver = hasPermission('inventario.articulos')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [articlesError, setArticlesError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadVisit = useCallback(async (): Promise<Visit> => {
    const res = await api.get<Visit>(`/visits/${visitId}`)
    return res.data
  }, [visitId])

  const loadArticles = useCallback(async (): Promise<Article[]> => {
    return fetchAll<Article>('/articles', { tipo: 'CONSUMIBLE', activo: 1 })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingVisit(true)
    loadVisit()
      .then((v) => {
        if (!cancelled) {
          setVisit(v)
          setVisitError(null)
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
  }, [loadVisit])

  const visitValida =
    visit !== null && (visit.estado === 'PENDIENTE' || visit.estado === 'REPROGRAMADA')

  useEffect(() => {
    if (!canDeliver || !visitValida) return
    let cancelled = false
    loadArticles()
      .then((arts) => {
        if (!cancelled) {
          setArticles(arts)
          setArticlesError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setArticlesError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canDeliver, visitValida, loadArticles])

  const articuloSeleccionado = useMemo(
    () => articles?.find((a) => a.id === selectedId) ?? null,
    [articles, selectedId]
  )

  const filtrados = useMemo(() => {
    if (!articles) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        (a.marca ?? '').toLowerCase().includes(q) ||
        (a.modelo_sku ?? '').toLowerCase().includes(q)
    )
  }, [articles, busqueda])

  const cantidadNum = Number.parseInt(cantidad || '0', 10) || 0
  const cantidadValida =
    articuloSeleccionado !== null &&
    cantidadNum >= 1 &&
    cantidadNum <= articuloSeleccionado.stock_actual

  async function recargarTodo(): Promise<Article[]> {
    const [v, arts] = await Promise.all([loadVisit(), loadArticles()])
    setVisit(v)
    setArticles(arts)
    return arts
  }

  async function handleSubmit() {
    if (selectedId === null || !cantidadValida) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/visits/${visitId}/deliver-article`, {
        articulo_id: selectedId,
        cantidad: cantidadNum,
      })
      const arts = await recargarTodo()
      const restante = arts.find((a) => a.id === selectedId)?.stock_actual
      const nombre = articuloSeleccionado?.nombre ?? 'Insumo'
      toast.success(`${nombre} entregado · stock restante: ${restante ?? '-'}`)
      setSelectedId(null)
      setCantidad('1')
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
      try {
        await recargarTodo()
      } catch {
        // se conserva el error original
      }
    } finally {
      setSubmitting(false)
    }
  }

  const entregas = visit?.entregas ?? []

  return (
    <div>
      <PageHeader
        title={visit ? (visit.cliente_nombre ?? 'Entrega de insumos') : 'Entrega de insumos'}
        onBack={() => navigate(`/visita/${visitId}`)}
      />
      <Page>
        {!canDeliver && (
          <Banner tone="error">
            No tienes permiso para entregar insumos (se requiere el permiso de artículos de
            inventario).
          </Banner>
        )}
        {!online && canDeliver && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. La entrega de insumos requiere conexión a internet.
            </Banner>
          </div>
        )}

        {loadingVisit && <SkeletonCard />}

        {visitError && (
          <div className="mb-4">
            <Banner tone="error">{visitError}</Banner>
          </div>
        )}

        {visit && !visitValida && (
          <div className="mb-4">
            <Banner tone="warn">
              La visita está en estado {visit.estado} y ya no admite entregas.
            </Banner>
          </div>
        )}

        {canDeliver && visitValida && (
          <>
            <SectionTitle hint="Selecciona el insumo a entregar">Insumos disponibles</SectionTitle>

            {articlesError && (
              <div className="mb-4">
                <Banner tone="error">{articlesError}</Banner>
              </div>
            )}

            {articles === null && !articlesError && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {articles !== null && (
              <>
                <div className="mb-3">
                  <TextInput
                    type="search"
                    placeholder="Buscar por nombre, marca o SKU..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>

                {filtrados.length === 0 && (
                  <EmptyState icon="📦" text="No hay consumibles activos que coincidan" />
                )}

                {filtrados.map((a) => {
                  const sinStock = a.stock_actual <= 0
                  return (
                    <Card
                      key={a.id}
                      className={`mb-3 ${selectedId === a.id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                      onClick={sinStock ? undefined : () => setSelectedId(a.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800">{a.nombre}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {a.marca ?? '-'} · {a.modelo_sku ?? '-'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {a.subtipo ?? 'CONSUMIBLE'} · {formatMoney(Number(a.costo_unitario ?? 0))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {selectedId === a.id && <span className="block text-blue-600">✓</span>}
                          <span
                            className={`text-xs font-semibold ${sinStock ? 'text-red-600' : 'text-gray-600'}`}
                          >
                            stock: {a.stock_actual}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </>
            )}

            {articuloSeleccionado && (
              <div className="mt-5">
                <Field
                  label={`Cantidad de ${articuloSeleccionado.nombre}`}
                  help={`Disponible: ${articuloSeleccionado.stock_actual}`}
                  error={cantidadNum < 1 || cantidadNum > articuloSeleccionado.stock_actual ? 'Cantidad fuera de rango' : null}
                >
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={articuloSeleccionado.stock_actual}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {submitError && (
              <div className="mb-4">
                <Banner tone="error">{submitError}</Banner>
              </div>
            )}

            <Button
              block
              className="mt-4"
              disabled={!cantidadValida || !online || submitting}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Confirmar entrega
            </Button>
          </>
        )}

        {entregas.length > 0 && (
          <section className="mt-8">
            <SectionTitle>Ya entregado en esta visita</SectionTitle>
            {entregas.map((d) => (
              <Card key={d.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {d.article?.nombre ?? `Artículo #${d.articulo_id}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {d.article?.marca ?? '-'} · {d.article?.modelo_sku ?? '-'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm text-gray-600">
                    <p>×{d.cantidad}</p>
                    <p className="text-xs">{formatMoney(Number(d.subtotal ?? 0))}</p>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </Page>
    </div>
  )
}
