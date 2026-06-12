import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
