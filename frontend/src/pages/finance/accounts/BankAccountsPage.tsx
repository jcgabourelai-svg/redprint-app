import { useState } from 'react'
import { Landmark, Plus, Eye, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useBankAccounts, useCreateBankAccount, useBankMovements } from '@/hooks/useBankAccounts'
import type { BankAccount, BankMovement } from '@/types/bank-account'
import { parseApiError } from '@/lib/api-errors'

const tipoLabels: Record<string, string> = {
  cheques: 'Cta. Cheques',
  debito: 'Tarjeta Deb.',
  ahorro: 'Cta. Ahorro',
}

const conciliacionLabels: Record<string, string> = {
  conciliado: 'Conciliada',
  pendiente: 'Pendiente',
  no_reconocido: 'No reconocido',
}

export default function BankAccountsPage() {
  const { data: accountsData, isLoading, error } = useBankAccounts()
  const [accountId, setAccountId] = useState<string | null>(null)
  const { data: movementsData } = useBankMovements(accountId || '')
  const createBankAccount = useCreateBankAccount()
  
  const [showNewAccountModal, setShowNewAccountModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [newAccount, setNewAccount] = useState({
    banco: 'BBVA',
    tipo: 'cheques' as 'cheques' | 'debito' | 'ahorro',
    moneda: 'MXN',
    numero_cuenta: '',
    saldo_inicial: 0,
    descripcion: '',
  })
  const [createError, setCreateError] = useState('')

  const accounts = accountsData?.data || []
  const movements = movementsData?.data || []

  const totalSaldo = accounts.reduce((sum, acc) => sum + acc.saldo, 0)

  const handleCreateAccount = async () => {
    setCreateError('')
    try {
      await createBankAccount.mutateAsync(newAccount)
      setShowNewAccountModal(false)
      setNewAccount({
        banco: 'BBVA',
        tipo: 'cheques',
        moneda: 'MXN',
        numero_cuenta: '',
        saldo_inicial: 0,
        descripcion: '',
      })
    } catch (err) {
      setCreateError(parseApiError(err))
    }
  }

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cuentas Bancarias</h2>
            <p className="text-sm text-gray-500">Gestion de cuentas bancarias y movimientos</p>
          </div>
          <Button onClick={() => setShowNewAccountModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando cuentas...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error al cargar cuentas: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <Landmark className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Saldo</p>
                      <p className="text-lg font-bold">{formatCurrency(totalSaldo)}</p>
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
                      <p className="text-sm text-gray-500">Cuentas</p>
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
                      <p className="text-sm text-gray-500">Pendientes Conciliar</p>
                      <p className="text-lg font-bold text-yellow-600">
                        {accounts.filter(a => a.conciliacion_status === 'PENDIENTE').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Banco</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">No. Cuenta</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Saldo Actual</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{account.banco}</td>
                      <td className="py-3 px-4">{tipoLabels[account.tipo]}</td>
                      <td className="py-3 px-4 text-gray-600">{account.numero_cuenta}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(account.saldo)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={account.conciliacion_status === 'CONCILIADO' ? 'success' : 'warning'}
                        >
                          {conciliacionLabels[account.conciliacion_status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Ver movimientos"
                            onClick={() => {
                              setSelectedAccount(account)
                              setAccountId(account.id)
                            }}
                          >
                            <Eye className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total saldo: <strong>{formatCurrency(totalSaldo)}</strong></span>
              <span>Cuentas: <strong>{accounts.length}</strong></span>
            </div>
          </>
        )}
      </div>

      {selectedAccount && (
        <Modal
          isOpen={!!selectedAccount}
          onClose={() => setSelectedAccount(null)}
          title={`${selectedAccount.banco} - ${tipoLabels[selectedAccount.tipo]}`}
          size="xl"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-1">
              <p className="text-sm text-gray-600">Banco: <strong>{selectedAccount.banco}</strong></p>
              <p className="text-sm text-gray-600">Tipo: <strong>{tipoLabels[selectedAccount.tipo]}</strong></p>
              <p className="text-sm text-gray-600">No. Cuenta: <strong>{selectedAccount.numero_cuenta}</strong></p>
              <p className="text-sm text-gray-600">Moneda: <strong>{selectedAccount.moneda}</strong></p>
              <p className="text-sm text-gray-600">Saldo actual: <strong>{formatCurrency(selectedAccount.saldo)}</strong></p>
              <p className="text-sm text-gray-600">
                Estado:{' '}
                <Badge variant={selectedAccount.conciliacion_status === 'CONCILIADO' ? 'success' : 'warning'}>
                  {conciliacionLabels[selectedAccount.conciliacion_status]}
                </Badge>
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Movimientos Recientes</h4>
              <div className="space-y-2">
                {movements.length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">No hay movimientos registrados</p>
                )}
                {movements.map((mov) => (
                  <div key={mov.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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
                        <Badge variant={mov.conciliacion_status === 'CONCILIADO' ? 'success' : 'error'}>
                          {mov.conciliacion_status === 'CONCILIADO' ? 'Conciliado' : 'Pendiente'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
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

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setSelectedAccount(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={showNewAccountModal}
        onClose={() => setShowNewAccountModal(false)}
        title="Nueva Cuenta Bancaria"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
            <Select
              options={[
                { value: 'BBVA', label: 'BBVA' },
                { value: 'Santander', label: 'Santander' },
                { value: 'Bancomer', label: 'Bancomer' },
                { value: 'HSBC', label: 'HSBC' },
                { value: 'Otro', label: 'Otro' },
              ]}
              value={newAccount.banco}
              onChange={(v) => setNewAccount({ ...newAccount, banco: v })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cuenta *</label>
            <Select
              options={[
                { value: 'cheques', label: 'Cuenta de Cheques' },
                { value: 'debito', label: 'Tarjeta de Debito' },
                { value: 'ahorro', label: 'Cuenta de Ahorro' },
              ]}
              value={newAccount.tipo}
              onChange={(v) => setNewAccount({ ...newAccount, tipo: v })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda *</label>
            <Select
              options={[
                { value: 'MXN', label: 'MXN' },
                { value: 'USD', label: 'USD' },
              ]}
              value={newAccount.moneda}
              onChange={(v) => setNewAccount({ ...newAccount, moneda: v })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numero de cuenta / CLABE *</label>
            <Input
              value={newAccount.numero_cuenta}
              onChange={(e) => setNewAccount({ ...newAccount, numero_cuenta: e.target.value })}
              placeholder="002-1234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial ($)</label>
            <Input
              type="number"
              value={newAccount.saldo_inicial}
              onChange={(e) => setNewAccount({ ...newAccount, saldo_inicial: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <Input
              value={newAccount.descripcion}
              onChange={(e) => setNewAccount({ ...newAccount, descripcion: e.target.value })}
              placeholder="Descripcion de la cuenta"
            />
          </div>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{createError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowNewAccountModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAccount}
              disabled={createBankAccount.isPending}
            >
              {createBankAccount.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}