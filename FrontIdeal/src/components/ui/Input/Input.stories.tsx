import type { Meta, StoryObj } from '@storybook/react'
import Input from '@/components/ui/Input'

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Texto placeholder',
  },
}

export const WithValue: Story = {
  args: {
    value: 'Valor del campo',
  },
}

export const WithError: Story = {
  args: {
    placeholder: 'Campo con error',
    error: true,
    helperText: 'Este campo es obligatorio',
  },
}

export const WithHelperText: Story = {
  args: {
    placeholder: 'Campo con ayuda',
    helperText: 'Texto de ayuda descriptivo',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Campo deshabilitado',
    disabled: true,
  },
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Contraseña',
  },
}
