import type { Meta, StoryObj } from '@storybook/react'
import ProgressBar from '@/components/ui/ProgressBar'

const meta: Meta<typeof ProgressBar> = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: 60,
  },
}

export const WithLabel: Story = {
  args: {
    value: 75,
    max: 100,
    showLabel: true,
  },
}

export const Small: Story = {
  args: {
    value: 45,
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    value: 80,
    size: 'lg',
  },
}

export const Success: Story = {
  args: {
    value: 100,
    color: 'success',
    showLabel: true,
  },
}

export const Warning: Story = {
  args: {
    value: 30,
    color: 'warning',
    showLabel: true,
  },
}

export const Error: Story = {
  args: {
    value: 15,
    color: 'error',
    showLabel: true,
  },
}

export const CustomMax: Story = {
  args: {
    value: 7,
    max: 10,
    showLabel: true,
  },
}
