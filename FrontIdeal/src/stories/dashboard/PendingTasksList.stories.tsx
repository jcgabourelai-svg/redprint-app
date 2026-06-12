import type { Meta, StoryObj } from '@storybook/react'
import PendingTasksList from '@/components/dashboard/PendingTasksList'
import { FileText, Calendar } from 'lucide-react'

const meta: Meta<typeof PendingTasksList> = {
  title: 'Dashboard/PendingTasksList',
  component: PendingTasksList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const sampleTasks = [
  {
    id: '1',
    title: 'Empresa A',
    subtitle: '$12,500 vencida - Juan Pérez',
    time: 'Vence: 15/05/2026',
    icon: <FileText className="h-4 w-4 text-red-500" />,
    status: 'high' as const,
  },
  {
    id: '2',
    title: 'Empresa B',
    subtitle: '$8,750 - María López',
    time: 'Vence: 20/05/2026',
    icon: <FileText className="h-4 w-4 text-amber-500" />,
    status: 'medium' as const,
  },
  {
    id: '3',
    title: 'Empresa C',
    subtitle: '$5,200 - Carlos Gómez',
    time: 'Vence: 22/05/2026',
    icon: <FileText className="h-4 w-4 text-amber-500" />,
  },
]

export const Default: Story = {
  args: {
    title: 'Facturas Pendientes',
    tasks: sampleTasks,
    viewAllText: 'Ver todas las facturas',
  },
}

export const WithSubtitle: Story = {
  args: {
    title: 'Próximas Visitas',
    subtitle: 'Hoy (8 de mayo de 2026)',
    tasks: [
      {
        id: '1',
        title: 'Empresa A',
        subtitle: 'María López - 2 impresoras',
        time: '14:00',
        icon: <Calendar className="h-4 w-4 text-blue-500" />,
      },
      {
        id: '2',
        title: 'Empresa B',
        subtitle: 'Carlos Gómez - 3 impresoras',
        time: '16:00',
        icon: <Calendar className="h-4 w-4 text-blue-500" />,
      },
    ],
    viewAllText: 'Ver calendario',
  },
}

export const Empty: Story = {
  args: {
    title: 'Tareas Pendientes',
    tasks: [],
  },
}
