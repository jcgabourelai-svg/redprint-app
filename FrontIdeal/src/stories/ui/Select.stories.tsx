import type { Meta, StoryObj } from '@storybook/react'
import Select, { SelectOption } from '@/components/ui/Select'

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const options: SelectOption[] = [
  { value: 'opt1', label: 'Opción 1' },
  { value: 'opt2', label: 'Opción 2' },
  { value: 'opt3', label: 'Opción 3' },
  { value: 'opt4', label: 'Opción 4', disabled: true },
]

export const Default: Story = {
  args: {
    options,
    onChange: () => {},
  },
}

export const Searchable: Story = {
  args: {
    options: [
      ...options,
      { value: 'opt5', label: 'Opción con texto largo para probar búsqueda' },
      { value: 'opt6', label: 'Opción de prueba adicional' },
    ],
    searchable: true,
    onChange: () => {},
  },
}

export const WithValue: Story = {
  args: {
    options,
    value: 'opt2',
    onChange: () => {},
  },
}

export const WithError: Story = {
  args: {
    options,
    error: true,
    onChange: () => {},
  },
}

export const Disabled: Story = {
  args: {
    options,
    disabled: true,
    onChange: () => {},
  },
}
