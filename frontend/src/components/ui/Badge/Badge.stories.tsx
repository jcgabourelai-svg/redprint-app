import type { Meta, StoryObj } from '@storybook/react'
import Badge from '@/components/ui/Badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    children: 'Primario',
    variant: 'primary',
  },
}

export const Success: Story = {
  args: {
    children: 'Éxito',
    variant: 'success',
  },
}

export const Warning: Story = {
  args: {
    children: 'Advertencia',
    variant: 'warning',
  },
}

export const Error: Story = {
  args: {
    children: 'Error',
    variant: 'error',
  },
}

export const Info: Story = {
  args: {
    children: 'Información',
    variant: 'info',
  },
}

export const PrinterStatus: Story = {
  args: {
    children: 'En almacén',
    variant: 'printer_status',
    color: 'en_almacen',
  },
}

export const PrinterStatusRentada: Story = {
  args: {
    children: 'Rentada',
    variant: 'printer_status',
    color: 'rentada',
  },
}

export const PrinterStatusMantenimiento: Story = {
  args: {
    children: 'En mantenimiento',
    variant: 'printer_status',
    color: 'en_mantenimiento',
  },
}

export const DocumentStatusVencido: Story = {
  args: {
    children: 'Vencido',
    variant: 'document_status',
    color: 'vencido',
  },
}

export const DocumentStatusPagado: Story = {
  args: {
    children: 'Pagado',
    variant: 'document_status',
    color: 'pagado',
  },
}

export const DocumentStatusSuspendido: Story = {
  args: {
    children: 'Suspendido',
    variant: 'document_status',
    color: 'suspendido',
  },
}
