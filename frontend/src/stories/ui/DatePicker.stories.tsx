import type { Meta, StoryObj } from '@storybook/react'
import DatePicker from '@/components/ui/DatePicker'

const meta: Meta<typeof DatePicker> = {
  title: 'UI/DatePicker',
  component: DatePicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onChange: () => {},
  },
}

export const WithValue: Story = {
  args: {
    value: '2026-05-09',
    onChange: () => {},
  },
}

export const WithError: Story = {
  args: {
    error: true,
    onChange: () => {},
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    onChange: () => {},
  },
}
