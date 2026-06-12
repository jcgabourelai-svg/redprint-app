import type { Meta, StoryObj } from '@storybook/react'
import Button from '@/components/ui/Button'

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    children: 'Botón Primario',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Botón Secundario',
    variant: 'secondary',
  },
}

export const Danger: Story = {
  args: {
    children: 'Eliminar',
    variant: 'danger',
  },
}

export const Ghost: Story = {
  args: {
    children: 'Cancelar',
    variant: 'ghost',
  },
}

export const Outline: Story = {
  args: {
    children: 'Ver Detalles',
    variant: 'outline',
  },
}

export const Sizes: Story = {
  args: {
    children: 'Botón',
  },
  render: (args) => (
    <div className="flex gap-2">
      <Button {...args} size="sm">Small</Button>
      <Button {...args} size="md">Medium</Button>
      <Button {...args} size="lg">Large</Button>
    </div>
  ),
}

export const Loading: Story = {
  args: {
    children: 'Cargando...',
    loading: true,
  },
}

export const Disabled: Story = {
  args: {
    children: 'Deshabilitado',
    disabled: true,
  },
}
