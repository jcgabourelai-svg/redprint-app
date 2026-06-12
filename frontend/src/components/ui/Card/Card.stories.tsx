import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Título de Card</CardTitle>
        <CardDescription>Descripción de la tarjeta</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Contenido de la tarjeta con información relevante.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="sm">Cancelar</Button>
        <Button size="sm">Confirmar</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px] p-6">
      <p>Card simple con contenido directo.</p>
    </Card>
  ),
}

export const KPI: Story = {
  render: () => (
    <Card className="w-[200px] p-6">
      <p className="text-sm text-gray-500">Ingresos del mes</p>
      <p className="text-2xl font-bold">$125,430.00</p>
      <p className="text-xs text-green-500 mt-1">↑ 12% vs mes anterior</p>
    </Card>
  ),
}
