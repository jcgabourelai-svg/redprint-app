import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import WarehouseList from '@/pages/inventory/warehouses/WarehouseList'

const meta: Meta<typeof WarehouseList> = {
  title: 'Warehouse/WarehouseList',
  component: WarehouseList,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    mockData: [],
  },
}

export const Loading: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="animate-pulse space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-64 bg-gray-100 rounded" />
            </div>
            <div className="h-10 w-36 bg-gray-200 rounded-md" />
          </div>
          <div className="h-10 w-full max-w-md bg-gray-100 rounded-md" />
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 h-12" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 border-t border-gray-100 bg-white" />
            ))}
          </div>
        </div>
      </MemoryRouter>
    ),
  ],
}

export const Filtered: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}
