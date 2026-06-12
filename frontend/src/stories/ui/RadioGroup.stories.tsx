import type { Meta, StoryObj } from '@storybook/react'
import RadioGroup from '@/components/ui/RadioGroup'

const meta: Meta<typeof RadioGroup> = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const options = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'suspended', label: 'Suspendido' },
]

export const Default: Story = {
  args: {
    name: 'status',
    options,
    onChange: () => {},
  },
}

export const WithValue: Story = {
  args: {
    name: 'status',
    options,
    value: 'active',
    onChange: () => {},
  },
}

export const WithDisabledOption: Story = {
  args: {
    name: 'status',
    options: [
      ...options,
      { value: 'deleted', label: 'Eliminado', disabled: true },
    ],
    onChange: () => {},
  },
}

export const Disabled: Story = {
  args: {
    name: 'status',
    options,
    disabled: true,
    onChange: () => {},
  },
}
