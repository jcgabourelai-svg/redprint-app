import type { Meta, StoryObj } from '@storybook/react'
import Checkbox from '@/components/ui/Checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Acepto los términos y condiciones',
    id: 'checkbox-default',
    onChange: () => {},
  },
}

export const Checked: Story = {
  args: {
    label: 'Acepto los términos y condiciones',
    id: 'checkbox-checked',
    checked: true,
    onChange: () => {},
  },
}

export const Disabled: Story = {
  args: {
    label: 'Opción no disponible',
    id: 'checkbox-disabled',
    disabled: true,
    onChange: () => {},
  },
}

export const WithoutLabel: Story = {
  args: {
    id: 'checkbox-no-label',
    onChange: () => {},
  },
}
