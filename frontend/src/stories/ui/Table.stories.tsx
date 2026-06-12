import type { Meta, StoryObj } from '@storybook/react'
import Table from '@/components/ui/Table'

const meta: Meta<typeof Table<{ id: number; name: string; status: string; amount: number }>> = {
  title: 'UI/Table',
  component: Table,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const data = [
  { id: 1, name: 'Impresora HP LaserJet', status: 'Activo', amount: 15000 },
  { id: 2, name: 'Impresora Canon PIXMA', status: 'En mantenimiento', amount: 8500 },
  { id: 3, name: 'Impresora Epson EcoTank', status: 'Activo', amount: 12000 },
  { id: 4, name: 'Impresora Brother HL', status: 'Dado de baja', amount: 5000 },
  { id: 5, name: 'Impresora Samsung Xpress', status: 'Activo', amount: 9800 },
]

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Nombre', sortable: true },
  {
    key: 'status',
    label: 'Estado',
    sortable: true,
    render: (value: string) => (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        value === 'Activo' ? 'bg-green-100 text-green-800' :
        value === 'En mantenimiento' ? 'bg-yellow-100 text-yellow-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        {value}
      </span>
    ),
  },
  {
    key: 'amount',
    label: 'Monto',
    sortable: true,
    render: (value: number) => `$${value.toLocaleString('es-MX')}`,
  },
]

export const Default: Story = {
  args: {
    data,
    columns,
  },
}

export const WithoutSearch: Story = {
  args: {
    data,
    columns,
    searchable: false,
  },
}

export const WithoutPagination: Story = {
  args: {
    data,
    columns,
    paginatable: false,
  },
}

export const Empty: Story = {
  args: {
    data: [],
    columns,
    emptyMessage: 'No se encontraron impresoras',
  },
}

export const WithRowClick: Story = {
  args: {
    data,
    columns,
    onRowClick: (row) => console.log('Row clicked:', row),
  },
}
