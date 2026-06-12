import type { Meta, StoryObj } from '@storybook/react'
import Calendar from '@/components/ui/Calendar'

const meta: Meta<typeof Calendar> = {
  title: 'UI/Calendar',
  component: Calendar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const sampleEvents = [
  {
    id: '1',
    date: new Date(),
    title: 'Lectura contador',
    type: 'lectura' as const,
    status: 'pendiente' as const,
    time: '09:00',
  },
  {
    id: '2',
    date: new Date(),
    title: 'Mantenimiento preventivo',
    type: 'mantenimiento' as const,
    status: 'completada' as const,
    time: '11:00',
  },
  {
    id: '3',
    date: new Date(),
    title: 'Instalación nueva',
    type: 'instalacion' as const,
    status: 'reprogramada' as const,
    time: '14:00',
  },
  {
    id: '4',
    date: new Date(new Date().setDate(new Date().getDate() + 1)),
    title: 'Retiro de equipo',
    type: 'retiro' as const,
    status: 'pendiente' as const,
    time: '10:00',
  },
  {
    id: '5',
    date: new Date(new Date().setDate(new Date().getDate() + 3)),
    title: 'Visita cancelada',
    type: 'mantenimiento' as const,
    status: 'cancelada' as const,
    time: '16:00',
  },
]

export const Default: Story = {
  args: {
    events: sampleEvents,
  },
}

export const Empty: Story = {
  args: {
    events: [],
  },
}

export const WithClickHandlers: Story = {
  args: {
    events: sampleEvents,
    onDateClick: (date) => console.log('Date clicked:', date),
    onEventClick: (event) => console.log('Event clicked:', event),
  },
}
