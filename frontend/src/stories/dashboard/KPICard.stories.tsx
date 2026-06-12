import type { Meta, StoryObj } from '@storybook/react'
import KPICard from '@/components/dashboard/KPICard'
import { DollarSign, FileText, Printer, AlertTriangle, Calendar } from 'lucide-react'

const meta: Meta<typeof KPICard> = {
  title: 'Dashboard/KPICard',
  component: KPICard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Ingresos del mes',
    value: '$125,000',
    subtitle: 'Mayo 2026',
    trend: 'up',
    trendValue: '5% vs mes anterior',
    icon: <DollarSign className="h-6 w-6 text-white" />,
    color: 'blue',
  },
}

export const DownTrend: Story = {
  args: {
    title: 'Facturas por cobrar',
    value: '$45,000',
    trend: 'down',
    trendValue: '3% vs mes anterior',
    icon: <FileText className="h-6 w-6 text-white" />,
    color: 'amber',
  },
}

export const NeutralTrend: Story = {
  args: {
    title: 'Impresoras rentadas',
    value: '42 / 55',
    trend: 'neutral',
    icon: <Printer className="h-6 w-6 text-white" />,
    color: 'green',
  },
}

export const NoTrend: Story = {
  args: {
    title: 'Visitas pendientes',
    value: '8',
    icon: <Calendar className="h-6 w-6 text-white" />,
    color: 'blue',
  },
}

export const Alert: Story = {
  args: {
    title: 'Alertas activas',
    value: '3',
    icon: <AlertTriangle className="h-6 w-6 text-white" />,
    color: 'red',
  },
}

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      <KPICard title="Blue" value="100" color="blue" icon={<DollarSign className="h-6 w-6 text-white" />} />
      <KPICard title="Green" value="100" color="green" icon={<Printer className="h-6 w-6 text-white" />} />
      <KPICard title="Amber" value="100" color="amber" icon={<FileText className="h-6 w-6 text-white" />} />
      <KPICard title="Red" value="100" color="red" icon={<AlertTriangle className="h-6 w-6 text-white" />} />
    </div>
  ),
}
