import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { redPrintColors } from '@/types/colors'
import type { PrinterEstado } from '@/types/api'

interface EstadoFlotaChartProps {
  data: Partial<Record<PrinterEstado, number>>
}

const ESTADO_CONFIG: Record<PrinterEstado, { label: string; color: string }> = {
  RENTADA: { label: 'Rentada', color: redPrintColors.success.DEFAULT },
  EN_ALMACEN: { label: 'En almacén', color: redPrintColors.primary.DEFAULT },
  EN_MANTENIMIENTO: { label: 'En mantenimiento', color: redPrintColors.warning.DEFAULT },
  DADA_DE_BAJA: { label: 'Dada de baja', color: redPrintColors.neutral.DEFAULT },
}

interface TooltipPayloadItem {
  name?: string
  payload?: { label?: string; total?: number }
  value?: number
}

function EstadoTooltip({ active, payload }: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  const entry = payload[0]
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{entry.payload?.label}</p>
      <p className="text-muted-foreground">{entry.value} impresora(s)</p>
    </div>
  )
}

export default function EstadoFlotaChart({ data }: EstadoFlotaChartProps) {
  const chartData = (Object.keys(ESTADO_CONFIG) as PrinterEstado[])
    .map((estado) => ({
      estado,
      label: ESTADO_CONFIG[estado].label,
      total: data[estado] ?? 0,
    }))
    .filter((d) => d.total > 0)

  const total = chartData.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">Estado de la flota</h3>
      {total === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          Sin impresoras registradas
        </div>
      ) : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.estado} fill={ESTADO_CONFIG[entry.estado].color} />
                ))}
              </Pie>
              <Tooltip content={<EstadoTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
