import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePrinterExpense } from '@/hooks/usePrinterExpenses'
import { usePrinters } from '@/hooks/usePrinters'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import type { Printer } from '@/types/models'
import { ExpenseType, EXPENSE_TYPE_LABELS } from '@/types/enums'

const typeOptions = Object.values(ExpenseType).map((t) => ({
  value: t,
  label: EXPENSE_TYPE_LABELS[t],
}))

export default function RegisterExpensePage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const createMutation = useCreatePrinterExpense()

  const [impresoraId, setImpresoraId] = useState('')
  const [tipo, setTipo] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const { data: printersData } = usePrinters({ page: 1, per_page: 100 })

  const printerOptions = printersData?.data.map((p: Printer) => ({
    value: String(p.id),
    label: `${p.codigo_negocio} - ${p.marca} ${p.modelo}`,
  })) ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync({
        impresora_id: Number(impresoraId),
        tipo,
        monto: Number(monto),
        fecha,
        descripcion: descripcion || null,
      })
      addToast('Gasto registrado', 'success')
      navigate(-1)
    } catch {
      addToast('Error al registrar el gasto', 'error')
    }
  }

  if (!printersData) {
    return <LoadingSpinner className="py-20" text="Cargando..." />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Registrar Gasto de Impresora</h1>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <Select
          label="Impresora"
          options={printerOptions}
          value={impresoraId}
          onChange={(e) => setImpresoraId(e.target.value)}
          placeholder="Selecciona una impresora"
        />
        <Select
          label="Tipo de Gasto"
          options={typeOptions}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Selecciona el tipo"
        />
        <Input
          label="Monto"
          type="number"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium leading-none text-foreground">
            Descripcion
          </label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!impresoraId || !tipo || !monto || !fecha}
          >
            Registrar Gasto
          </Button>
        </div>
      </form>
    </div>
  )
}
