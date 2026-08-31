import axios from 'axios'
import type { Paginated } from '../types/api'

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
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      const isSessionCheck = url.includes('/auth/user')
      const path = window.location.pathname
      if (!isSessionCheck && path !== '/m/login' && path !== '/login') {
        window.location.href = '/m/login'
      }
    }
    return Promise.reject(error)
  }
)

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined
    if (data?.errors) {
      const first = Object.values(data.errors)[0]
      if (first && first.length > 0) return first[0]
    }
    if (data?.message) return data.message
    if (!err.response) return 'Sin conexión con el servidor'
  }
  return 'Ocurrió un error inesperado'
}

export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response
}

export const FETCH_ALL_PAGE_SIZE = 100
export const FETCH_ALL_MAX_PAGES = 10

export async function fetchAll<T>(
  url: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T[]> {
  const out: T[] = []
  let page = 1
  for (let i = 0; i < FETCH_ALL_MAX_PAGES; i++) {
    const res = await api.get<Paginated<T>>(url, {
      params: { ...params, per_page: FETCH_ALL_PAGE_SIZE, page },
    })
    out.push(...res.data.data)
    const last = res.data.meta?.last_page ?? 1
    if (page >= last) break
    page++
  }
  return out
}

export default api
