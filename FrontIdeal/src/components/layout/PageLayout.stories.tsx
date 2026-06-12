import type { Meta, StoryObj } from '@storybook/react'
import PageLayout from '@/components/layout/PageLayout'

const meta = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PageLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Página de Ejemplo',
    showSearch: true,
    children: (
      <div className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Contenido de Ejemplo</h2>
          <p className="text-gray-600">
            Este es un ejemplo de contenido dentro del layout principal.
          </p>
        </div>
      </div>
    ),
  },
}
