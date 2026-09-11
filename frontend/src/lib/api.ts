import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    await axios.get('/sanctum/csrf-cookie', { baseURL: '' })
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

/**
 * Helper para subidas multipart (FormData).
 *
 * `api` fija `Content-Type: application/json` por defecto, lo que haria que
 * axios convirtiera el FormData a JSON (ver `axios/lib/defaults/index.js`:
 * isFormData + hasJSONContentType => JSON.stringify(formDataToJSON(data))).
 * Forzamos multipart para que el navegador anada el boundary correcto.
 */
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await api.post<T>(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// --- Actualización del sistema (canal de archivos con el orquestador del VPS) ---

export interface UpdateVersion {
  sha: string
  rama: string
  fecha: string
}

export interface UpdateStatus {
  estado: 'inactivo' | 'en_cola' | 'corriendo' | 'listo' | 'error' | string
  rama: string | null
  sha: string | null
  inicio: string | null
  fin: string | null
  detalle: string | null
  log: string | null
}

/** POST /system/update — 202 en cola; 409 si ya hay una en curso o en cola. */
export async function requestUpdate(): Promise<{ estado: string }> {
  const res = await api.post('/system/update')
  return res.data
}

/** GET /system/update/status — estado del run del orquestador + tail del log. */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const res = await api.get('/system/update/status')
  return res.data
}

/** GET /system/update/version — version instalada por el ultimo run. */
export async function getUpdateVersion(): Promise<{ version: UpdateVersion | null }> {
  const res = await api.get('/system/update/version')
  return res.data
}