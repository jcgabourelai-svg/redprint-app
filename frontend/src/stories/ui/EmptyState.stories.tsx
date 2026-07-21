import type { Meta, StoryObj } from '@storybook/react'
import { Package } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const WithAction: Story = {
  args: {
    icon: Package,
    title: 'No hay artículos',
    description: 'Comienza creando tu primer artículo para el catálogo de insumos.',
    action: {
      label: 'Nuevo Artículo',
      onClick: () => {},
    },
  },
}

export const WithoutAction: Story = {
  args: {
    icon: Package,
    title: 'No hay movimientos',
    description: 'Los movimientos de stock se generan desde el detalle de almacenes o impresoras.',
  },
}

export const Minimal: Story = {
  args: {
    icon: Package,
    title: 'Sin datos',
  },
}
