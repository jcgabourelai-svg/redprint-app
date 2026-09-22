import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface MaintenancePlan {
  id: number
  printer_model_id: number | null
  printer_id: number | null
  printer_model: { id: number; nombre: string; marca: string | null } | null
  printer: { id: number; marca: string | null; modelo: string | null; codigo: string | null } | null
  activo: boolean
  periodicidad_meses: number | null
  periodicidad_paginas: number | null
  ventana_aviso_dias: number
  ultimo_servicio_fecha: string | null
  ultimo_servicio_contador: number | null
  proximo_servicio_fecha: string | null
  proximo_servicio_contador: number | null
}

export interface PlanUpcomingItem {
  plan_id: number
  impresora_id: number
  impresora: {
    id: number
    marca: string | null
    modelo: string | null
    codigo: string | null
    estado: string
    contador_actual: number
  }
  origen_plan: 'IMPRESORA' | 'MODELO'
  periodicidad_meses: number | null
  periodicidad_paginas: number | null
  ultimo_servicio_fecha: string | null
  proximo_servicio_fecha: string | null
  dias_restantes: number | null
  paginas_restantes: number | null
  tiene_orden_abierta: boolean
  estado: 'VENCIDO' | 'PROXIMO'
  detalle: { eje: 'FECHA' | 'PAGINAS'; proximo: string | number; dias_restantes?: number; paginas_restantes?: number }[]
}

export interface MaintenancePlansResponse {
  data: MaintenancePlan[]
  upcoming: PlanUpcomingItem[]
}

export function useMaintenancePlans() {
  return useQuery<MaintenancePlansResponse>({
    queryKey: ['maintenance-plans'],
    queryFn: () => api.get('/maintenance-plans').then((r) => r.data),
  })
}

export function useUpcomingPlans() {
  return useQuery<PlanUpcomingItem[]>({
    queryKey: ['maintenance-plans', 'upcoming'],
    queryFn: () => api.get('/maintenance-plans/upcoming').then((r) => r.data.data),
  })
}

export function useCreateMaintenancePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/maintenance-plans', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] })
    },
  })
}

export function useUpdateMaintenancePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put(`/maintenance-plans/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] })
    },
  })
}

export function useDeactivateMaintenancePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/maintenance-plans/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] })
    },
  })
}

export function useCreateOrderFromPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, impresoraId, fecha }: { planId: number; impresoraId: number; fecha: string }) =>
      api
        .post(`/maintenance-plans/${planId}/create-order`, { impresora_id: impresoraId, fecha })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] })
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['taller'] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}

export function useCreateOrdersBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { impresora_id: number; plan_id: number; fecha: string }[]) =>
      api.post('/maintenance-plans/create-orders-batch', { items }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-plans'] })
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] })
      qc.invalidateQueries({ queryKey: ['taller'] })
      qc.invalidateQueries({ queryKey: ['printers'] })
    },
  })
}
