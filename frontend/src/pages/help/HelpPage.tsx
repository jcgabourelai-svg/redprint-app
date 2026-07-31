import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Warehouse,
  Boxes,
  Printer,
  Users,
  FileText,
  Calendar,
  Gauge,
  Wrench,
  Receipt,
  CreditCard,
  ShoppingCart,
  Landmark,
  CalendarClock,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

interface HelpStep {
  titulo: string
  descripcion: string
  ruta: string
  icono: LucideIcon
  permiso?: string
}

interface HelpSection {
  id: string
  titulo: string
  descripcion: string
  pasos: HelpStep[]
}

const SECCIONES: HelpSection[] = [
  {
    id: 'empezando',
    titulo: 'Empezando',
    descripcion: 'Sigue estos pasos en orden para dejar tu flota lista para operar. Cada paso depende del anterior.',
    pasos: [
      {
        titulo: 'Crea tu primer almacén',
        descripcion: 'El almacén es donde se guardan las impresoras y los repuestos antes de asignarlos a un cliente.',
        ruta: '/inventario/almacenes',
        icono: Warehouse,
        permiso: 'inventario.almacenes',
      },
      {
        titulo: 'Da de alta artículos y repuestos',
        descripcion: 'Registra los consumibles (tóner, tinta) y repuestos que usarás en mantenimientos, con su stock por almacén.',
        ruta: '/inventario/articulos',
        icono: Boxes,
        permiso: 'inventario.articulos',
      },
      {
        titulo: 'Registra tus impresoras',
        descripcion: 'Carga el parque de impresoras. Quedan disponibles en el inventario para asignarlas luego a un contrato.',
        ruta: '/inventario/impresoras',
        icono: Printer,
        permiso: 'inventario.impresoras',
      },
      {
        titulo: 'Crea tus clientes',
        descripcion: 'Los clientes son las empresas o personas a las que les rentas o das servicio de impresión.',
        ruta: '/clientes',
        icono: Users,
        permiso: 'clientes',
      },
      {
        titulo: 'Firma un contrato',
        descripcion: 'El contrato vincula una impresora del inventario con un cliente y define las condiciones (precio, lecturas mínimas, etc.).',
        ruta: '/contratos',
        icono: FileText,
        permiso: 'contratos',
      },
    ],
  },
  {
    id: 'operacion',
    titulo: 'Operación diaria',
    descripcion: 'Flujo recurrente: programa visitas, captura lecturas y gestiona mantenimientos.',
    pasos: [
      {
        titulo: 'Programa visitas',
        descripcion: 'Agenda las visitas técnicas a los equipos instalados en los clientes.',
        ruta: '/operaciones/visitas',
        icono: Calendar,
        permiso: 'operaciones.calendario',
      },
      {
        titulo: 'Captura lecturas de contador',
        descripcion: 'Registra los contadores de cada equipo en la visita. Las lecturas alimentan el cálculo de facturación.',
        ruta: '/operaciones/lecturas',
        icono: Gauge,
        permiso: 'operaciones.lecturas',
      },
      {
        titulo: 'Órdenes de mantenimiento',
        descripcion: 'Documenta reparaciones con las piezas utilizadas y su costo, afectando el stock y la rentabilidad.',
        ruta: '/inventario/mantenimiento',
        icono: Wrench,
        permiso: 'inventario.mantenimiento',
      },
    ],
  },
  {
    id: 'finanzas',
    titulo: 'Finanzas',
    descripcion: 'Del cobro al cierre contable: factura según lecturas/contrato, registra pagos y concilia.',
    pasos: [
      {
        titulo: 'Emite facturas',
        descripcion: 'Genera facturas a partir de las lecturas y las condiciones del contrato del cliente.',
        ruta: '/finanzas/facturas',
        icono: Receipt,
        permiso: 'finanzas.facturas',
      },
      {
        titulo: 'Registra pagos (Cuentas por Cobrar)',
        descripcion: 'Aplica los pagos que recibes de tus clientes contra sus facturas pendientes.',
        ruta: '/finanzas/cuentas-por-cobrar',
        icono: CreditCard,
        permiso: 'finanzas.cuentas-por-cobrar',
      },
      {
        titulo: 'Compras a proveedores',
        descripcion: 'Registra las compras de repuestos y consumibles, que generan cuentas por pagar.',
        ruta: '/finanzas/compras',
        icono: ShoppingCart,
        permiso: 'finanzas.compras',
      },
      {
        titulo: 'Cuentas por pagar',
        descripcion: 'Controla lo que debes a tus proveedores y registra sus pagos.',
        ruta: '/finanzas/cuentas-por-pagar',
        icono: CreditCard,
        permiso: 'finanzas.cuentas-por-pagar',
      },
      {
        titulo: 'Cuentas bancarias',
        descripcion: 'Configura tus cuentas bancarias donde se depositan y desde las que se pagan los movimientos.',
        ruta: '/finanzas/cuentas-bancarias',
        icono: Landmark,
        permiso: 'finanzas.cuentas-bancarias',
      },
      {
        titulo: 'Conciliación bancaria',
        descripcion: 'Cruza los movimientos bancarios importados con los pagos y cobros registrados en el sistema.',
        ruta: '/finanzas/conciliacion',
        icono: CheckCircle2,
        permiso: 'finanzas.conciliacion',
      },
      {
        titulo: 'Cierre de periodo',
        descripcion: 'Cierra el periodo contable una vez conciliado para bloquear ediciones y consolidar los saldos.',
        ruta: '/finanzas/cierre',
        icono: CalendarClock,
        permiso: 'finanzas.cierre',
      },
      {
        titulo: 'Reporte de rentabilidad',
        descripcion: 'Analiza la utilidad por impresora, contrato y cliente (ingresos vs. costos de mantenimiento).',
        ruta: '/finanzas/rentabilidad',
        icono: BarChart3,
        permiso: 'finanzas.rentabilidad',
      },
      {
        titulo: 'Flujo de caja',
        descripcion: 'Visualiza entradas y salidas de efectivo a lo largo del tiempo.',
        ruta: '/finanzas/flujo-caja',
        icono: TrendingUp,
        permiso: 'finanzas.flujo-caja',
      },
    ],
  },
  {
    id: 'sistema',
    titulo: 'Administración del sistema',
    descripcion: 'Configuración disponible solo para administradores.',
    pasos: [
      {
        titulo: 'Gestión de usuarios y roles',
        descripcion: 'Crea usuarios y asígnales roles con permisos específicos por módulo.',
        ruta: '/sistema/usuarios',
        icono: ShieldCheck,
        permiso: 'sistema.usuarios',
      },
    ],
  },
]

const GLOSARIO: { termino: string; definicion: string }[] = [
  {
    termino: 'Almacén',
    definicion: 'Ubicación física donde se guardan impresoras y repuestos antes de asignarlos a un cliente.',
  },
  {
    termino: 'Contrato',
    definicion: 'Acuerdo que vincula una impresora con un cliente y define las condiciones comerciales (precio, lecturas mínimas, etc.).',
  },
  {
    termino: 'Lectura',
    definicion: 'Registro del contador de un equipo en una visita. Es la base para calcular el consumo y la facturación.',
  },
  {
    termino: 'Visita',
    definicion: 'Desplazamiento técnico programado a un cliente para revisar equipos, tomar lecturas o realizar mantenimiento.',
  },
  {
    termino: 'CFDI',
    definicion: 'Comprobante Fiscal Digital por Internet. El comprobante fiscal electrónico mexicano asociado a una factura.',
  },
  {
    termino: 'Conciliación',
    definicion: 'Cruce entre los movimientos bancarios reales y los cobros/pagos registrados para verificar que coincidan.',
  },
  {
    termino: 'Cierre de periodo',
    definicion: 'Bloqueo del periodo contable tras conciliar, para fijar saldos y evitar modificaciones posteriores.',
  },
]

export default function HelpPage() {
  const { user } = useAuth()
  const tienePermiso = (clave?: string) => {
    if (!clave) return true
    if (!user) return false
    if (user.es_sistema) return true
    return (user.permisos ?? []).includes(clave)
  }

  return (
    <PageLayout title="Ayuda › Cómo empezar">
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Centro de ayuda</h2>
            <p className="text-sm text-muted-foreground">
              RedPrint gestiona tu flota de impresoras de extremo a extremo. Sigue el flujo en orden:
              primero el inventario, luego los clientes y contratos, y por último la operación y las finanzas.
            </p>
          </div>
        </div>

        {SECCIONES.map((seccion) => {
          const pasosVisibles = seccion.pasos.filter((p) => tienePermiso(p.permiso))
          if (pasosVisibles.length === 0) return null

          return (
            <Card key={seccion.id}>
              <CardHeader>
                <CardTitle>{seccion.titulo}</CardTitle>
                <p className="text-sm text-muted-foreground">{seccion.descripcion}</p>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {pasosVisibles.map((paso, idx) => {
                    const Icon = paso.icono
                    return (
                      <li key={paso.ruta} className="relative">
                        <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{paso.titulo}</h4>
                              <p className="text-sm text-muted-foreground">{paso.descripcion}</p>
                            </div>
                          </div>
                          <Link
                            to={paso.ruta}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            Ir
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
          )
        })}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Glosario</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {GLOSARIO.map((item) => (
                <div key={item.termino} className="rounded-lg border border-border p-4">
                  <dt className="text-sm font-semibold text-foreground">{item.termino}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{item.definicion}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
