import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface TallerKpis {
  no_operativas: number
  requiere_atencion: number
  en_taller: number
  disponibles_renta: number
  para_piezas: number
  sin_condicion: number
}

export interface TallerColaItem {
  orden_id: number
  severidad: string | null
  tipo_mantto: string | null
  desc_problema: string | null
  dias_desde_creacion: number
  fecha_creacion: string | null
  impresora: { id: number; marca: string | null; modelo: string | null; codigo: string | null } | null
}

export interface TallerSinOrdenItem {
  id: number
  marca: string | null
  modelo: string | null
  codigo: string | null
}

export interface TallerMatrizFila {
  estado: string
  OPERATIVA: number
  REQUIERE_ATENCION: number
  NO_OPERATIVA: number
  PIEZAS: number
  sin_condicion: number
  total: number
}

export interface TallerPiezaBajoUmbral {
  id: number
  nombre: string
  stock_actual: number
  stock_minimo: number
}

export interface TallerDashboardData {
  kpis: TallerKpis
  cola: TallerColaItem[]
  sin_orden: TallerSinOrdenItem[]
  matriz_estado_condicion: TallerMatrizFila[]
  piezas_bajo_umbral: TallerPiezaBajoUmbral[]
  productividad_mes: {
    abiertas: number
    completadas_mes: number
    costo_mes: number
    pct_correctivas: number
    mttr_dias: number
  }
}

export function useTallerDashboard() {
  return useQuery<TallerDashboardData>({
    queryKey: ['taller', 'dashboard'],
    queryFn: () => api.get('/taller/dashboard').then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
  })
}
