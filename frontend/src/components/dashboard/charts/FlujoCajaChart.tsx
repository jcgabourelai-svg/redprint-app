import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FlujoMes } from '@/types/api'
import { formatCurrency } from '@/lib/formatters'
import { redPrintColors } from '@/types/colors'

interface FlujoCajaChartProps {
  data: FlujoMes[]
}

interface TooltipPayloadItem {
  name?: string
  value?: number
  color?: string
}

function FlujoTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="capitalize">
          {entry.name}: {formatCurrency(entry.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

export default function FlujoCajaChart({ data }: FlujoCajaChartProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">Flujo de caja (6 meses)</h3>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes_nombre" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" width={70} />
            <Tooltip content={<FlujoTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill={redPrintColors.success.DEFAULT} radius={[4, 4, 0, 0]} />
            <Bar dataKey="egresos" name="Egresos" fill={redPrintColors.error.DEFAULT} radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="flujo_neto"
              name="Flujo neto"
              stroke={redPrintColors.primary.DEFAULT}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
