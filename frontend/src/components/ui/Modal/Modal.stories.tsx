import type { Meta } from '@storybook/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useState } from 'react'

const meta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>

export default meta

export const Default = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Abrir Modal</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Título del Modal">
          <p>Contenido del modal con información relevante.</p>
        </Modal>
      </>
    )
  },
}

export const Small = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Modal Pequeño</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirmar acción" size="sm">
          <p>¿Está seguro de que desea continuar?</p>
        </Modal>
      </>
    )
  },
}

export const Large = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Modal Grande</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Detalle completo" size="lg">
          <p>Contenido con más espacio para mostrar información detallada.</p>
        </Modal>
      </>
    )
  },
}

export const WithoutTitle = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Sin Título</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <p>Modal sin título, solo contenido.</p>
        </Modal>
      </>
    )
  },
}
