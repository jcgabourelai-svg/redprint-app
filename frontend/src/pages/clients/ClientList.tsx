import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { TablePagination } from '@/components/ui/TablePagination'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { Textarea } from '@/components/ui/Textarea'
import { useClients, useCreateClient } from '@/hooks/useClients'
import { formatDate } from '@/lib/utils'

export default function ClientList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, error, refetch } = useClients({
    page,
    per_page: 15,
    search: search || undefined,
  })

  const createMutation = useCreateClient()

  const clients = data?.data ?? []
  const totalPages = data?.last_page ?? 1

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre o RFC..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {isLoading && <LoadingSpinner text="Cargando clientes..." />}
        {error && <ErrorMessage message="Error al cargar clientes" onRetry={() => refetch()} />}

        {!isLoading && !error && clients.length === 0 && (
          <EmptyState
            title="No hay clientes"
            description="Crea un nuevo cliente para comenzar"
            actionLabel="Nuevo Cliente"
            onAction={() => setShowCreate(true)}
          />
        )}

        {!isLoading && !error && clients.length > 0 && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razon Social</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Correo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/clientes/${client.id}`)}
                    >
                      <TableCell className="font-medium">{client.razon_social}</TableCell>
                      <TableCell>{client.rfc ?? '—'}</TableCell>
                      <TableCell>{client.nombre_contacto}</TableCell>
                      <TableCell>{client.telefono}</TableCell>
                      <TableCell>{client.correo ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <CreateClientModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          createMutation.mutate(data, {
            onSuccess: () => setShowCreate(false),
          })
        }}
        loading={createMutation.isPending}
      />
    </PageLayout>
  )
}

interface CreateClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
}

function CreateClientModal({ isOpen, onClose, onSubmit, loading }: CreateClientModalProps) {
  const [form, setForm] = useState({
    razon_social: '',
    rfc: '',
    nombre_contacto: '',
    telefono: '',
    correo: '',
    direccion_instalacion: '',
    notas: '',
  })

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="razon_social"
          label="Razon Social"
          value={form.razon_social}
          onChange={(e) => handleChange('razon_social', e.target.value)}
          required
        />
        <Input
          id="rfc"
          label="RFC"
          value={form.rfc}
          onChange={(e) => handleChange('rfc', e.target.value)}
        />
        <Input
          id="nombre_contacto"
          label="Nombre Contacto"
          value={form.nombre_contacto}
          onChange={(e) => handleChange('nombre_contacto', e.target.value)}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="telefono"
            label="Telefono"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            required
          />
          <Input
            id="correo"
            label="Correo"
            type="email"
            value={form.correo}
            onChange={(e) => handleChange('correo', e.target.value)}
          />
        </div>
        <Input
          id="direccion_instalacion"
          label="Direccion de Instalacion"
          value={form.direccion_instalacion}
          onChange={(e) => handleChange('direccion_instalacion', e.target.value)}
          required
        />
        <Textarea
          id="notas"
          label="Notas"
          value={form.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear Cliente
          </Button>
        </div>
      </form>
    </Modal>
  )
}
