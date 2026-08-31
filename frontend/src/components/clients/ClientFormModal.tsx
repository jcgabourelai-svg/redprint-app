import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { Client } from '@/types/client'
import { useCreateClient } from '@/hooks/useClients'
import { parseApiError } from '@/lib/api-errors'

const emptyClient = {
  razon_social: '',
  rfc: '',
  nombre_contacto: '',
  telefono: '',
  correo: '',
  direccion_instalacion: '',
  notas: '',
}

export type ClientFormValues = typeof emptyClient

interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  initialValues?: Partial<ClientFormValues>
  onCreated?: (client: Client) => void
}

export default function ClientFormModal({
  isOpen,
  onClose,
  title = 'Nuevo Cliente',
  initialValues,
  onCreated,
}: ClientFormModalProps) {
  const createClient = useCreateClient()
  const [newClient, setNewClient] = useState<ClientFormValues>({
    ...emptyClient,
    ...initialValues,
  })
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNewClient({ ...emptyClient, ...initialValues })
      setCreateError('')
    }
  }, [isOpen, initialValues])

  const handleCreateClient = () => {
    setCreateError('')
    createClient.mutate(newClient, {
      onSuccess: (created) => {
        onClose()
        setNewClient({ ...emptyClient })
        onCreated?.(created as Client)
      },
      onError: (err) => {
        setCreateError(parseApiError(err))
      },
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose()
        setCreateError('')
      }}
      title={title}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Razón social / Nombre *
          </label>
          <Input
            value={newClient.razon_social}
            onChange={(e) => setNewClient({ ...newClient, razon_social: e.target.value })}
            placeholder="Nombre de la empresa"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            RFC / Identificación fiscal
          </label>
          <Input
            value={newClient.rfc}
            onChange={(e) => setNewClient({ ...newClient, rfc: e.target.value })}
            placeholder="AAAA010101ABC"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Nombre del contacto *
          </label>
          <Input
            value={newClient.nombre_contacto}
            onChange={(e) => setNewClient({ ...newClient, nombre_contacto: e.target.value })}
            placeholder="Juan Pérez"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Teléfono *
          </label>
          <Input
            value={newClient.telefono}
            onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
            placeholder="55-1234-5678"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Correo electrónico
          </label>
          <Input
            type="email"
            value={newClient.correo}
            onChange={(e) => setNewClient({ ...newClient, correo: e.target.value })}
            placeholder="correo@empresa.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Dirección de instalación *
          </label>
          <textarea
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            value={newClient.direccion_instalacion}
            onChange={(e) => setNewClient({ ...newClient, direccion_instalacion: e.target.value })}
            placeholder="Av. Reforma 123, Col. Centro, CDMX, 06000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Notas
          </label>
          <textarea
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            value={newClient.notas}
            onChange={(e) => setNewClient({ ...newClient, notas: e.target.value })}
            placeholder="Observaciones del cliente"
          />
        </div>
        {createError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
            {createError}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={() => {
              onClose()
              setCreateError('')
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleCreateClient} disabled={createClient.isPending}>
            {createClient.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
