import type { Meta, StoryObj } from '@storybook/react'
import Tabs from '@/components/ui/Tabs'

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const tabs = [
  { id: 'tab1', label: 'General', content: <div>Contenido de la pestaña General</div> },
  { id: 'tab2', label: 'Detalles', content: <div>Contenido de la pestaña Detalles</div> },
  { id: 'tab3', label: 'Historial', content: <div>Contenido de la pestaña Historial</div> },
]

export const Underline: Story = {
  args: {
    tabs,
    variant: 'underline',
  },
}

export const Boxed: Story = {
  args: {
    tabs,
    variant: 'boxed',
  },
}

export const WithDisabledTab: Story = {
  args: {
    tabs: [
      ...tabs,
      { id: 'tab4', label: 'Configuración', content: <div>Configuración</div>, disabled: true },
    ],
    variant: 'underline',
  },
}
