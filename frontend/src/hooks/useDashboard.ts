import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { DashboardData } from '@/types/api'

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  })
}
