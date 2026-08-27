import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import { SyncManager } from '../lib/sync'
import { compressImage } from '../lib/photo'
import type { FieldRecordPayload } from '../lib/db'
import {
  Banner,
  Button,
  Card,
  Field,
  Page,
  PageHeader,
  SectionTitle,
  TextArea,
  TextInput,
} from '../components/ui'

type TipoRegistro = FieldRecordPayload['tipo']

interface ArticuloRow {
  key: number
  descripcion: string
  cantidad: number
}

const TIPO_OPCIONES: { value: TipoRegistro; label: string }[] = [
  { value: 'LECTURA', label: 'Contador' },
  { value: 'ENTREGA_INSUMOS', label: 'Entrega de insumos' },
  { value: 'OTRO', label: 'Otro' },
]

let rowKeySeq = 0

/**
 * Registro de campo (staging): captura una visita no catalogada cuando el
 * cliente o la impresora no están en sistema. Siempre pasa por la cola del
 * SyncManager (un solo code path online/offline); la regularización
 * (vincular a cliente/contrato/impresora reales) se hace en la bandeja web.
 */
export default function NewFieldRecordPage() {
  const goBackTo = useGoBack()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canRegistrar = hasPermission('operaciones.registros-campo')

  const [tipo, setTipo] = useState<TipoRegistro>('LECTURA')
  const [nombreLugar, setNombreLugar] = useState('')
  const [direccion, setDireccion] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [numSerie, setNumSerie] = useState('')
  const [valorContador, setValorContador] = useState('')
  const [articuloRows, setArticuloRows] = useState<ArticuloRow[]>([
    { key: ++rowKeySeq, descripcion: '', cantidad: 1 },
  ])
  const [notas, setNotas] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const valorNum = valorContador.trim() === '' ? null : Number.parseInt(valorContador, 10)
  const articulosValidos = useMemo(
    () => articuloRows.filter((r) => r.descripcion.trim() !== '' && r.cantidad >= 1),
    [articuloRows]
  )

  const puedeEnviar =
    canRegistrar &&
    nombreLugar.trim() !== '' &&
    (tipo !== 'LECTURA' || (valorNum !== null && valorNum >= 0 && Number.isFinite(valorNum))) &&
    (tipo !== 'ENTREGA_INSUMOS' || articulosValidos.length > 0) &&
    !submitting &&
    !saved

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const dataUri = await compressImage(file)
      setPhoto(dataUri)
    } catch {
      toast.error('No se pudo procesar la foto')
    } finally {
      setPhotoBusy(false)
    }
  }

  function handleGps() {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no disponible en este dispositivo')
      return
    }
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsBusy(false)
      },
      () => {
        toast.error('No se pudo obtener la ubicación')
        setGpsBusy(false)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  async function handleSubmit() {
    if (!puedeEnviar) return
    setSubmitting(true)
    setFormError(null)
    try {
      const payload: FieldRecordPayload = {
        tipo,
        nombre_cliente_reportado: nombreLugar.trim(),
        direccion_reportada: direccion.trim() || null,
        marca_reportada: marca.trim() || null,
        modelo_reportada: modelo.trim() || null,
        num_serie_reportado: numSerie.trim() || null,
        valor_contador: tipo === 'LECTURA' ? valorNum : null,
        articulos_entregados:
          tipo === 'ENTREGA_INSUMOS'
            ? articulosValidos.map((r) => ({ descripcion: r.descripcion.trim(), cantidad: r.cantidad }))
            : null,
        notas: notas.trim() || null,
        foto_evidencia: photo,
        ubicacion_lat: gps?.lat ?? null,
        ubicacion_lng: gps?.lng ?? null,
        capturado_en: new Date().toISOString(),
        client_uuid:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `fr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      }
      // D-C: siempre por la cola (un solo code path). Con red, el SyncManager
      // dispara la sincronización al instante.
      await SyncManager.enqueueFieldRecord(payload)
      setSaved(true)
      toast.success(
        online
          ? 'Registro guardado, sincronizando…'
          : 'Registro en cola, se enviará cuando haya conexión'
      )
    } catch {
      setFormError('No se pudo guardar el registro localmente. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canRegistrar) {
    return (
      <div>
        <PageHeader title="Registro de campo" onBack={() => goBackTo('/')} />
        <Page>
          <Banner tone="error">
            No tienes permiso para capturar registros de campo (se requiere el permiso de
            operaciones › Registros de campo).
          </Banner>
        </Page>
      </div>
    )
  }

  if (saved) {
    return (
      <div>
        <PageHeader title="Registro de campo" onBack={() => goBackTo('/')} />
        <Page>
          <Card className="mb-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-800">✅ Registro capturado</p>
            <p className="mt-1 text-sm text-emerald-900">
              {online
                ? 'Se está sincronizando con el sistema.'
                : 'Quedó en la cola offline y se enviará automáticamente cuando haya conexión.'}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Un administrador lo regularizará desde la bandeja web de “Operaciones › Registros de
              campo”.
            </p>
          </Card>
          <Button block onClick={() => navigate('/', { replace: true })}>
            Volver a mis visitas
          </Button>
        </Page>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Registro de campo" onBack={() => goBackTo('/')} />
      <Page>
        {!online && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. El registro se guardará en el teléfono y se sincronizará después.
            </Banner>
          </div>
        )}

        <Card className="mb-4">
          <p className="text-sm text-gray-600">
            Usa esta pantalla cuando el cliente o la impresora <strong>no estén en el sistema</strong>.
            Captura los datos tal cual los ves: un administrador los vinculará a las entidades
            reales desde la web.
          </p>
        </Card>

        <SectionTitle>¿Qué estás registrando?</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2">
          {TIPO_OPCIONES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setTipo(o.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tipo === o.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Field label="Nombre del lugar / cliente *" help="Tal cual aparece en el sitio (texto libre)">
          <TextInput
            placeholder="Ej. Tacos El Güero"
            value={nombreLugar}
            onChange={(e) => setNombreLugar(e.target.value)}
          />
        </Field>

        <Field label="Dirección" help="Opcional">
          <TextInput
            placeholder="Calle y número, colonia"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </Field>

        <SectionTitle hint="Opcional: ayuda al administrador a identificar la impresora">
          Impresora reportada
        </SectionTitle>
        <Field label="Marca">
          <TextInput
            placeholder="Ej. HP"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
          />
        </Field>
        <Field label="Modelo">
          <TextInput
            placeholder="Ej. LaserJet Pro M404"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
          />
        </Field>
        <Field label="N° de serie">
          <TextInput
            placeholder="Ej. VNC4G05567"
            value={numSerie}
            onChange={(e) => setNumSerie(e.target.value)}
          />
        </Field>

        {tipo === 'LECTURA' && (
          <Field label="Contador actual *" help="El valor que muestra el contador de la impresora">
            <TextInput
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={valorContador}
              onChange={(e) => setValorContador(e.target.value)}
            />
          </Field>
        )}

        {tipo === 'ENTREGA_INSUMOS' && (
          <>
            <SectionTitle hint="Qué dejaste en el sitio (texto libre, no requiere catálogo)">
              Insumos entregados *
            </SectionTitle>
            <div className="space-y-3">
              {articuloRows.map((row, idx) => (
                <div key={row.key} className="rounded-xl border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                      Artículo {idx + 1}
                    </span>
                    {articuloRows.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600"
                        onClick={() =>
                          setArticuloRows((rows) => rows.filter((r) => r.key !== row.key))
                        }
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TextInput
                        placeholder="Ej. Tóner negro 85A"
                        value={row.descripcion}
                        onChange={(e) =>
                          setArticuloRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key ? { ...r, descripcion: e.target.value } : r
                            )
                          )
                        }
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={row.cantidad}
                      onChange={(e) =>
                        setArticuloRows((rows) =>
                          rows.map((r) =>
                            r.key === row.key
                              ? { ...r, cantidad: Math.max(1, Number(e.target.value) || 1) }
                              : r
                          )
                        )
                      }
                      className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-4 mt-2">
              <Button
                variant="secondary"
                block
                onClick={() =>
                  setArticuloRows((rows) => [
                    ...rows,
                    { key: ++rowKeySeq, descripcion: '', cantidad: 1 },
                  ])
                }
              >
                + Agregar artículo
              </Button>
            </div>
          </>
        )}

        <Field label="Notas" help="Opcional: contexto que ayude a regularizar el registro">
          <TextArea
            rows={3}
            placeholder="Observaciones adicionales…"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </Field>

        <div className="mb-4 space-y-3">
          {photo ? (
            <div>
              <img
                src={photo}
                alt="Evidencia del registro"
                className="max-h-48 w-full rounded-xl object-cover"
              />
              <button
                onClick={() => setPhoto(null)}
                className="mt-2 text-xs font-semibold text-red-600"
              >
                Quitar foto
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id="foto-registro-campo"
                onChange={(e) => void handlePhoto(e)}
              />
              <Button
                variant="secondary"
                block
                loading={photoBusy}
                onClick={() => document.getElementById('foto-registro-campo')?.click()}
              >
                📷 Tomar foto de evidencia
              </Button>
            </>
          )}

          {gps ? (
            <Card className="bg-emerald-50">
              <p className="text-sm font-medium text-emerald-800">
                ✓ Ubicación capturada ({gps.lat.toFixed(5)}, {gps.lng.toFixed(5)})
              </p>
            </Card>
          ) : (
            <Button variant="secondary" block loading={gpsBusy} onClick={handleGps}>
              📍 Capturar ubicación (opcional)
            </Button>
          )}
        </div>

        {formError && (
          <div className="mb-4">
            <Banner tone="error">{formError}</Banner>
          </div>
        )}

        <Button block disabled={!puedeEnviar} loading={submitting} onClick={() => void handleSubmit()}>
          {online ? 'Guardar registro' : 'Guardar (se sincronizará después)'}
        </Button>
      </Page>
    </div>
  )
}
