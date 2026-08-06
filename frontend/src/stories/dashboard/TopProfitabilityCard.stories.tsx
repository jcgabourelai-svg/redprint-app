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
    impresora_id: '1',
    marca: 'HP',
    modelo: 'HP LaserJet',
    codigo_negocio: 'IMP-001',
    ingresos: 12000,
    costos: 3500,
    margen: 8500,
    roi: 12.5,
  },
  {
    impresora_id: '2',
    marca: 'Canon',
    modelo: 'Canon imageRUNNER',
    codigo_negocio: 'IMP-005',
    ingresos: 9500,
    costos: 3300,
    margen: 6200,
    roi: 9.1,
  },
  {
    impresora_id: '3',
    marca: 'Brother',
    modelo: 'Brother HL-L2350',
    codigo_negocio: 'IMP-012',
    ingresos: 6800,
    costos: 2700,
    margen: 4100,
    roi: 6.2,
  },
  {
    impresora_id: '4',
    marca: 'Epson',
    modelo: 'Epson EcoTank',
    codigo_negocio: 'IMP-008',
    ingresos: 6500,
    costos: 2700,
    margen: 3800,
    roi: 5.8,
  },
  {
    impresora_id: '5',
    marca: 'Xerox',
    modelo: 'Xerox Phaser',
    codigo_negocio: 'IMP-020',
    ingresos: 2100,
    costos: 3300,
    margen: -1200,
    roi: -1.8,
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
