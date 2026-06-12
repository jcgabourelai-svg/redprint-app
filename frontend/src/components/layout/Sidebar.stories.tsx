import type { Meta, StoryObj } from '@storybook/react'
import Sidebar from '@/components/layout/Sidebar'

const meta = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    isOpen: true,
    onToggle: () => {},
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
    onToggle: () => {},
  },
}
