import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import WarehouseForm from '@/components/warehouse/WarehouseForm'
import type { WarehouseFormData } from '@/types/warehouse'

const meta: Meta<typeof WarehouseForm> = {
  title: 'Warehouse/WarehouseForm',
  component: WarehouseForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="w-[500px]">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof WarehouseForm>

const handleSubmit = (data: WarehouseFormData) => {
  console.log('Form submitted:', data)
}

export const Create: Story = {
  args: {
    onSubmit: handleSubmit,
    onCancel: () => console.log('Cancelled'),
    isEdit: false,
  },
}

export const Edit: Story = {
  args: {
    initialData: {
      id: 'ALM-001',
      nombre: 'Almacén Centro',
      direccion: 'Av. Insurgentes Sur 1250, Col. Del Valle, CDMX',
      encargado: 'Carlos Martínez',
      telefono: '55 1234 5678',
      ocupacionActual: 12,
      estado: 'activo',
      notas: 'Almacén principal de la empresa',
      fechaCreacion: '2024-01-15',
    },
    onSubmit: handleSubmit,
    onCancel: () => console.log('Cancelled'),
    isEdit: true,
  },
}

export const Validation: Story = {
  args: {
    initialData: {
      nombre: '',
      direccion: '',
      encargado: '',
      estado: 'activo',
    },
    onSubmit: handleSubmit,
    onCancel: () => console.log('Cancelled'),
    isEdit: false,
  },
}
