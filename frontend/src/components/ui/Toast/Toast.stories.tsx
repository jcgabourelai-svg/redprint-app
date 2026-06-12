import type { Meta } from '@storybook/react'
import Toast from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { useState } from 'react'

const meta = {
  title: 'UI/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Toast>

export default meta

export const Success = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Toast Éxito</Button>
        <Toast isOpen={isOpen} onClose={() => setIsOpen(false)} variant="success" title="Guardado" message="Los cambios se guardaron correctamente." />
      </>
    )
  },
}

export const Error = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button variant="danger" onClick={() => setIsOpen(true)}>Toast Error</Button>
        <Toast isOpen={isOpen} onClose={() => setIsOpen(false)} variant="error" title="Error" message="No se pudo completar la acción." />
      </>
    )
  },
}

export const Warning = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button variant="outline" onClick={() => setIsOpen(true)}>Toast Advertencia</Button>
        <Toast isOpen={isOpen} onClose={() => setIsOpen(false)} variant="warning" title="Atención" message="Stock bajo en 3 artículos." />
      </>
    )
  },
}

export const Info = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <>
        <Button variant="ghost" onClick={() => setIsOpen(true)}>Toast Info</Button>
        <Toast isOpen={isOpen} onClose={() => setIsOpen(false)} variant="info" message="Tienes 5 visitas programadas para hoy." />
      </>
    )
  },
}
