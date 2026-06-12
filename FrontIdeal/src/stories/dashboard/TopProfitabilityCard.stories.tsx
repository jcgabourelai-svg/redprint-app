import type { Meta, StoryObj } from '@storybook/react'
import TopProfitabilityCard from '@/components/dashboard/TopProfitabilityCard'

const meta: Meta<typeof TopProfitabilityCard> = {
  title: 'Dashboard/TopProfitabilityCard',
  component: TopProfitabilityCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const samplePrinters = [
  {
    id: '1',
    name: 'IMP-001',
    model: 'HP LaserJet',
    profitability: 8500,
    trend: 'up' as const,
  },
  {
    id: '2',
    name: 'IMP-005',
    model: 'Canon imageRUNNER',
    profitability: 6200,
    trend: 'up' as const,
  },
  {
    id: '3',
    name: 'IMP-012',
    model: 'Brother HL-L2350',
    profitability: 4100,
    trend: 'up' as const,
  },
  {
    id: '4',
    name: 'IMP-008',
    model: 'Epson EcoTank',
    profitability: 3800,
    trend: 'up' as const,
  },
  {
    id: '5',
    name: 'IMP-020',
    model: 'Xerox Phaser',
    profitability: -1200,
    trend: 'down' as const,
  },
]

export const Default: Story = {
  args: {
    title: 'Rentabilidad Top 5',
    printers: samplePrinters,
    viewReportText: 'Ver reporte',
  },
}

export const AllPositive: Story = {
  args: {
    title: 'Mejores Impresoras',
    printers: samplePrinters.slice(0, 3),
  },
}

export const Empty: Story = {
  args: {
    title: 'Rentabilidad Top 5',
    printers: [],
  },
}
