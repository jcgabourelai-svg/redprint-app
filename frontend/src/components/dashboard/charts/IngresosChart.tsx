import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { IngresoMes } from '@/types/api'
import { formatCurrency } from '@/lib/formatters'
import { redPrintColors } from '@/types/colors'

interface IngresosChartProps {
  data: IngresoMes[]
}

interface TooltipPayloadItem {
  value?: number
}

function IngresosTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-primary">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

export default function IngresosChart({ data }: IngresosChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">Ingresos (6 meses)</h3>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ingresosGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={redPrintColors.primary.DEFAULT} stopOpacity={0.35} />
                <stop offset="95%" stopColor={redPrintColors.primary.DEFAULT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes_nombre" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" width={70} />
            <Tooltip content={<IngresosTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke={redPrintColors.primary.DEFAULT}
              strokeWidth={2}
              fill="url(#ingresosGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
