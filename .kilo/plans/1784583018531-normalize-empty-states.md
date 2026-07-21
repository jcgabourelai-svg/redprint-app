# Plan: Normalizar Empty State en catálogos/listados

## Contexto

Hoy los catálogos vacíos del frontend son inconsistentes:

- **Patrón referencia (bueno):** `WarehouseList.tsx` muestra un bloque central con icono + título + mensaje + botón "Crear" (además del botón superior derecho).
- **~11 vistas** delegan al `<Table>` genérico con `emptyMessage` (sólo texto plano dentro de la tabla, sin CTA): `PrinterList`, `MovementList`, `MaintenanceList`, `ArticleList`, `ContractList`, `ClientList`, `ReadingListPage`, `CalendarPage`, `ReceivablesList`, `PurchaseList`, `PaymentList`, `InvoiceList`.
- **3 vistas con tablas/listas custom** (no usan `<Table>`): `UserListPage`, `BankAccountsPage`, `NotificationCenterPage`.
- No existe componente `EmptyState` reutilizable.

**Decisión tomada con el usuario:** extender el patrón `WarehouseList` a **todos** los catálogos/listados, extrayendo un componente `<EmptyState>` compartido.

## Patrón objetivo (único)

Para cada catálogo/listado:

1. **Cabecera siempre** con título + descripción + botón primario superior derecho (tal como está hoy). El botón superior derecho **se mantiene** incluso con la lista vacía (es el atajo cuando ya hay registros).
2. **Estado vacío "virgen"** (no hay registros Y no hay filtros activos): bloque `<EmptyState>` centrado con:
   - Icono (lucide) acorde al catálogo.
   - Título corto ("No hay X").
   - Mensaje guía orientado a la acción.
   - **CTA**: idéntico al botón primario de la cabecera (mismo `onClick`, mismo label, mismo *gating* de `isAdmin`). Si el catálogo **no tiene** acción de creación directa (p. ej. movimientos, lecturas, cuentas por cobrar, notificaciones), la CTA **se omite** y se deja sólo el mensaje.
3. **Estado vacío "filtrado"** (hay filtros/búsqueda activos y 0 resultados): mensaje **dentro de la tabla/lista** vía `emptyMessage` del `<Table>` (texto plano), sin CTA central. *No* se usa el bloque centrado aquí para evitar lógica de detección de filtros en el componente genérico y porque el contexto de "estaba filtrando" queda más claro in-table.

> Excepción documentada: `WarehouseList` hoy usa bloque centrado también para el caso filtrado. Se refactoriza para alinearla al patrón (bloque centrado sólo para virgen; in-table para filtrado) y dejar todas iguales.

### Regla mecánica de CTA

> La CTA del `<EmptyState>` **es un espejo** del botón primario de la cabecera: mismo handler, mismo texto, mismo `useIsAdmin`. Si la cabecera no tiene botón de creación, el EmptyState no tiene CTA.

## Componente a crear

`frontend/src/components/ui/EmptyState.tsx`

Props (mínimo):

```ts
interface EmptyStateProps {
  icon: LucideIcon            // componente de lucide-react
  title: string               // "No hay impresoras"
  description?: string        // mensaje guía
  action?: {                  // opcional; si se omite, no se renderiza botón
    label: string
    onClick: () => void
  }
  className?: string
}
```

Render: `flex flex-col items-center justify-center py-16 text-center` con icono `h-16 w-16 text-muted-foreground mb-4`, título `text-lg font-semibold text-muted-foreground mb-2`, descripción `text-sm text-muted-foreground mb-4`, y `<Button>` con la acción. (Mismas clases que el bloque actual de `WarehouseList`.)

Añadir story en `frontend/src/stories/ui/EmptyState.stories.tsx` (con variantes: con acción, sin acción).

## Cambios por vista

Para cada catalog/list view: cuando `data.length === 0` y no hay filtros activos, renderizar `<EmptyState .../>` **en lugar de** `<Table>`/lista; en caso contrario renderizar la tabla como hoy. El `emptyMessage` del `<Table>` se reescribe a la variante "sin resultados con los filtros aplicados".

### Vistas con `<Table>` genérico (12)

| Vista | Icono | Título | Descripción | CTA (espejo cabecera) |
|---|---|---|---|---|
| `inventory/printers/PrinterList.tsx` | `Printer` | No hay impresoras | Comienza registrando tu primera impresora para gestionar el inventario. | "Nueva Impresora" (admin) |
| `inventory/movements/MovementList.tsx` | `ArrowLeftRight` | No hay movimientos | Los movimientos de stock se generan desde el detalle de almacenes o impresoras. | (verificar; si no hay botón cabecera → sin CTA) |
| `inventory/maintenance/MaintenanceList.tsx` | `Wrench` | No hay órdenes de mantenimiento | Crea una orden para registrar el mantenimiento de una impresora. | espejo botón cabecera (admin) |
| `inventory/articles/ArticleList.tsx` | `Package` | No hay artículos | Comienza creando tu primer artículo para el catálogo de insumos. | espejo cabecera (admin) |
| `contracts/ContractList.tsx` | `FileText` | No hay contratos | Crea un contrato para vincular un cliente con una impresora. | espejo cabecera (admin) |
| `clients/ClientList.tsx` | `Users` | No hay clientes | Registra tu primer cliente para gestionar contratos y visitas. | espejo cabecera (admin) |
| `operations/readings/ReadingListPage.tsx` | `Gauge` | No hay lecturas | Las lecturas se capturan desde la página de captura de lecturas. | (verificar; probablemente sin CTA) |
| `operations/calendar/CalendarPage.tsx` | `Calendar` | No hay visitas | Programa visitas desde el calendario o el detalle de un contrato. | (verificar) |
| `finance/receivables/ReceivablesList.tsx` | `Wallet` | No hay cuentas por cobrar | Se generan automáticamente al registrar facturas. | sin CTA |
| `finance/purchases/PurchaseList.tsx` | `ShoppingCart` | No hay compras | Registra una compra para añadir artículos al inventario. | espejo cabecera (admin) |
| `finance/payments/PaymentList.tsx` | `CreditCard` | No hay pagos | Registra un pago para conciliar cuentas. | espejo cabecera (admin) |
| `finance/invoices/InvoiceList.tsx` | `Receipt` | No hay facturas | Registra una factura para iniciar la facturación. | espejo cabecera (admin) |

### Vistas con tabla/lista custom (3)

| Vista | Icono | Título | Descripción | CTA |
|---|---|---|---|---|
| `admin/UserListPage.tsx` | `Users` | No hay usuarios | Invita o crea el primer usuario del sistema. | espejo cabecera (admin) |
| `finance/accounts/BankAccountsPage.tsx` | `Landmark` | No hay cuentas bancarias | Registra tu primera cuenta para la conciliación. | espejo cabecera (admin) |
| `admin/NotificationCenterPage.tsx` | `Bell` | No hay notificaciones | Las notificaciones del sistema aparecerán aquí. | sin CTA |

> Para estas tres, la detección de "vacío" se hace sobre su propia fuente de datos (no usan `<Table>`); inyectar el `<EmptyState>` en el bloque donde hoy aparece el mensaje plano.

### Vista referencia

`inventory/warehouses/WarehouseList.tsx`: refactorizar el JSX inline (líneas 217–228 y 229–239) para usar `<EmptyState>` en el caso virgen y dejar el caso filtrado como in-table. Mantiene su mensaje actual: "Comienza creando tu primer almacén para gestionar las ubicaciones de impresoras." + CTA "Crear Almacén".

## Tareas ordenadas

1. **Crear `EmptyState.tsx`** en `frontend/src/components/ui/` + su story.
2. **Refactorizar `WarehouseList.tsx`** para consumir `<EmptyState>` (validación visual de referencia).
3. **Adaptar las 12 vistas con `<Table>` genérico**:
   - Detectar "vacío virgen" (`data.length === 0 && sinFiltrosActivos`) → renderizar `<EmptyState>`.
   - Ajustar `emptyMessage` a "No se encontraron X con los filtros aplicados".
   - Conectar la CTA (cuando aplique) al mismo handler que el botón de cabecera, con `useIsAdmin`.
4. **Adaptar las 3 vistas custom** (`UserListPage`, `BankAccountsPage`, `NotificationCenterPage`) reemplazando su mensaje plano por `<EmptyState>`.
5. **Lint + typecheck** del frontend.
6. **Recompilar el `dist` en Docker** (`docker compose run --rm --no-deps frontend sh -c "npm run build"`) y aviso de hard refresh en 8080.

## Notas de implementación

- **Detección de "vacío virgen":** comparar `data.length === 0` con el estado de filtros **del padre** (no del `<Table>` interno). En listas server-side (`useServerTable`), considerar virgen cuando no haya `search`, `filters` ni `sort` aplicados; basta con revisar los valores controlados que ya maneja cada página.
- **No cambiar** el script `npm run build` (vacía `dist` sin borrar la carpeta — ver AGENTS.md).
- **No tocar** detail pages (`*Detail.tsx`) ni sub-secciones "no hay X en este detalle": ese es otro patrón (empty de sub-lista) fuera de alcance.
- **No proponer** `npm run dev` en host ni puertos 3000/5173.

## Validación

- En cada catálogo, con BD vacía para esa entidad: comprobar que aparece el `<EmptyState>` centrado con icono + mensaje + CTA (si aplica), y que la CTA abre el mismo modal/flujo que el botón superior derecho.
- Con datos pero aplicando un filtro que deje 0 resultados: comprobar que se ve el mensaje in-table (no el bloque centrado).
- Para catálogos sin acción de creación (movimientos, lecturas, receivables, notificaciones): verificar que **no** aparece botón en el EmptyState.
- Verificar que un usuario **no admin** no ve la CTA donde aplique `isAdmin` (igual que el botón de cabecera).
- `npm run lint` y `npm run build` (dentro de Docker) sin errores.

## Fuera de alcance

- Empty states de sub-listas en páginas de detalle (p. ej. "No hay visitas programadas" en `ContractDetail`).
- Pantallas de reportes/dashboard (`ProfitabilityReport`, `CashFlowReport`, `Dashboard`).
- Estados de error/carga (se mantienen como hoy).
