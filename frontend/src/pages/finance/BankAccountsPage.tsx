import { useState } from 'react'
import { useBankAccounts, useBankMovements, useCreateBankAccount } from '@/hooks/useBankAccounts'
import { BANK_ACCOUNT_TYPE_LABELS, BankAccountType, BankName, Currency, RECONCILIATION_STATUS_LABELS, ReconciliationStatus } from '@/types/enums'
import type { BankAccount } from '@/types/models'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Landmark, DollarSign, Eye, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'error'> = {
  CONCILIADO: 'success',
  PENDIENTE: 'warning',
  NO_RECONOCIDO: 'error',
}

export default function BankAccountsPage() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [newAccount, setNewAccount] = useState({
    banco: BankName.BBVA,
    tipo: BankAccountType.CHEQUES,
    moneda: Currency.MXN,
    numero_cuenta: '',
    saldo_inicial: 0,
    descripcion: '',
  })

  const { data, isLoading, isError, refetch } = useBankAccounts()
  const { data: movementsData } = useBankMovements(selectedAccount?.id ?? 0)
  const createMutation = useCreateBankAccount()

  const accounts = data?.data ?? []
  const mxnAccounts = accounts.filter(a => a.moneda === Currency.MXN)
  const usdAccounts = accounts.filter(a => a.moneda === Currency.USD)
  const totalSaldoMXN = mxnAccounts.reduce((sum, a) => sum + a.saldo, 0)
  const totalSaldoUSD = usdAccounts.reduce((sum, a) => sum + a.saldo, 0)
  const pendientesCount = accounts.filter(a => a.conciliacion_status === ReconciliationStatus.PENDIENTE).length

  const handleCreate = () => {
    createMutation.mutate(newAccount, {
      onSuccess: () => setShowNewModal(false),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cuentas Bancarias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion de cuentas bancarias y movimientos
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>Nueva cuenta</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Landmark className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Saldo (MXN)</p>
                <p className="text-lg font-bold">{formatCurrency(totalSaldoMXN)}</p>
                {totalSaldoUSD > 0 && (
                  <p className="text-xs text-muted-foreground">USD: {formatCurrency(totalSaldoUSD)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cuentas</p>
                <p className="text-lg font-bold">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 p-2">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendientes Conciliar</p>
                <p className="text-lg font-bold text-yellow-600">{pendientesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && <LoadingSpinner text="Cargando cuentas..." />}
      {isError && <ErrorMessage message="Error al cargar cuentas bancarias" onRetry={() => refetch()} />}

      {data && !isLoading && (
        <>
          {accounts.length === 0 ? (
            <EmptyState title="Sin cuentas bancarias" description="No se encontraron cuentas bancarias" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>No. Cuenta</TableHead>
                  <TableHead className="text-right">Saldo Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.banco}</TableCell>
                    <TableCell>{BANK_ACCOUNT_TYPE_LABELS[account.tipo]}</TableCell>
                    <TableCell className="text-muted-foreground">{account.numero_cuenta}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(account.saldo)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[account.conciliacion_status] ?? 'default'}>
                        {RECONCILIATION_STATUS_LABELS[account.conciliacion_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAccount(account)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <Modal isOpen={!!selectedAccount} onClose={() => setSelectedAccount(null)} title={`${selectedAccount?.banco ?? ''} - ${selectedAccount ? BANK_ACCOUNT_TYPE_LABELS[selectedAccount.tipo] : ''}`}>
        {selectedAccount && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-1 text-sm">
              <p>Banco: <strong>{selectedAccount.banco}</strong></p>
              <p>Tipo: <strong>{BANK_ACCOUNT_TYPE_LABELS[selectedAccount.tipo]}</strong></p>
              <p>No. Cuenta: <strong>{selectedAccount.numero_cuenta}</strong></p>
              <p>Moneda: <strong>{selectedAccount.moneda}</strong></p>
              <p>Saldo actual: <strong>{formatCurrency(selectedAccount.saldo)}</strong></p>
              <p>Estado: <Badge variant={statusBadgeVariant[selectedAccount.conciliacion_status] ?? 'default'}>{RECONCILIATION_STATUS_LABELS[selectedAccount.conciliacion_status]}</Badge></p>
            </div>

            <div>
              <h4 className="font-medium mb-3">Movimientos Recientes</h4>
              <div className="space-y-2">
                {(movementsData?.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay movimientos registrados</p>
                )}
                {(movementsData?.data ?? []).map((mov) => (
                  <div key={mov.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className={`rounded-full p-2 ${mov.tipo === 'DEPOSITO' ? 'bg-green-50' : 'bg-red-50'}`}>
                      {mov.tipo === 'DEPOSITO' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{mov.descripcion}</span>
                        <Badge variant={statusBadgeVariant[mov.conciliacion_status] ?? 'default'}>
                          {RECONCILIATION_STATUS_LABELS[mov.conciliacion_status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(mov.fecha)} · Ref: {mov.referencia}
                      </p>
                    </div>
                    <span className={`font-medium ${mov.tipo === 'DEPOSITO' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'DEPOSITO' ? '+' : '-'}{formatCurrency(mov.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nueva Cuenta Bancaria">
        <div className="space-y-4">
          <Select
            label="Banco *"
            options={Object.values(BankName).map(b => ({ value: b, label: b }))}
            value={newAccount.banco}
            onChange={(e) => setNewAccount({ ...newAccount, banco: e.target.value as BankName })}
          />
          <Select
            label="Tipo de cuenta *"
            options={Object.entries(BANK_ACCOUNT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={newAccount.tipo}
            onChange={(e) => setNewAccount({ ...newAccount, tipo: e.target.value as BankAccountType })}
          />
          <Select
            label="Moneda *"
            options={Object.values(Currency).map(c => ({ value: c, label: c }))}
            value={newAccount.moneda}
            onChange={(e) => setNewAccount({ ...newAccount, moneda: e.target.value as Currency })}
          />
          <Input
            label="Numero de cuenta / CLABE *"
            value={newAccount.numero_cuenta}
            onChange={(e) => setNewAccount({ ...newAccount, numero_cuenta: e.target.value })}
            placeholder="002-1234567"
          />
          <Input
            label="Saldo inicial ($)"
            type="number"
            value={newAccount.saldo_inicial}
            onChange={(e) => setNewAccount({ ...newAccount, saldo_inicial: Number(e.target.value) })}
          />
          <Input
            label="Descripcion"
            value={newAccount.descripcion}
            onChange={(e) => setNewAccount({ ...newAccount, descripcion: e.target.value })}
            placeholder="Descripcion de la cuenta"
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
