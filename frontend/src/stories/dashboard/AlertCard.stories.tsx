import type { Meta, StoryObj } from '@storybook/react'
import AlertCard from '@/components/dashboard/AlertCard'

const meta: Meta<typeof AlertCard> = {
  title: 'Dashboard/AlertCard',
  component: AlertCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Stock bajo',
    message: 'Tóner HP 85A (3 uds), Tambor Canon (1 ud)',
  },
}

export const Error: Story = {
  args: {
    type: 'error',
    title: 'Facturas vencidas',
    message: 'Total: $12,500',
    action: 'Ver detalle',
  },
}

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Operación exitosa',
    message: 'El pago ha sido registrado correctamente.',
  },
}

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Mantenimiento programado',
    message: 'Se ha programado mantenimiento para la impresora IMP-001.',
  },
}

export const WithAction: Story = {
  args: {
    type: 'error',
    title: 'Cliente sin visita',
    message: 'Empresa D - Última visita: 15/04/2026',
    action: 'Programar visita',
  },
}

export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4 w-[400px]">
      <AlertCard type="success" title="Éxito" message="Operación completada." />
      <AlertCard type="error" title="Error" message="Algo salió mal." />
      <AlertCard type="warning" title="Advertencia" message="Stock bajo." />
      <AlertCard type="info" title="Información" message="Actualización disponible." />
    </div>
  ),
}
