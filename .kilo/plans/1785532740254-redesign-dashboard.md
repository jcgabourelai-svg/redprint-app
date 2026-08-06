# Plan: Rediseño del Dashboard de RedPrint

## Contexto y problema

El dashboard actual (`frontend/src/pages/dashboard/Dashboard.tsx`) está desalineado
con el backend y con el negocio (gestión de flotas de impresoras rentadas).

**Bugs detectados (UI ↔ backend):**
- `kpis.facturas_pendientes` es un **conteo** en el backend pero el front lo muestra con `formatCurrency()` como dinero.
- El front usa claves inexistentes: `alertas.stock_bajo` (real: `articulos_stock_bajo`), `alertas.visitas_pendientes` (real: `visitas_proximas`), `kpis.facturas_pendientes_detalles`, `kpis.visitas_hoy`, `kpis.top_impresoras` → esas secciones quedan vacías.
- Valores hardcodeados: `'Mayo 2026'`, `'5% vs mes anterior'`, `'Hoy (8 de mayo de 2026)'`, tendencia `'down'` fija.

**Subutilización:** el `DashboardController` ya calcula `saldo_pendiente_total`, `valor_inventario`, `stock_critico`, mantenimientos, compras vencidas/por vencer y `ingresos_mes_anterior`, pero el front no los usa. No hay datos de **rentabilidad**, **flujo de caja**, **volumen de impresiones** ni **ocupación de flota** (el núcleo del negocio).

## Decisiones tomadas

1. **Gráficas:** añadir `recharts` (encaja con React 18 + Tailwind).
2. **Datos:** extender el único endpoint `GET /dashboard` (una sola petición, una caché de TanStack Query). No componer endpoints de reportes desde el front.
3. **Rol:** dashboard **único** que muestra/oculta widgets con `useTienePermiso()` (patrón existente). `es_sistema` ve todo.

## Alcance / Límites

- **Incluido:** refactor de `DashboardController`, nuevo tipo TS `DashboardData` tipado, nuevo layout, 4 charts con Recharts, corrección de bugs, eliminación de hardcodeos.
- **Fuera de alcance:** nuevas migraciones/DB, cambios de autenticación, variantes de dashboard por rol, i18n, exportación de gráficas.

## Contrato de datos objetivo (`GET /dashboard`)

Se mantiene la respuesta única. Estructura final:

```jsonc
{
  "kpis": {
    "ingresos_mes": 0,                  // ya existe
    "ingresos_mes_anterior": 0,         // ya existe
    "tendencia_ingresos_pct": 0,        // NUEVO: (mes/anterior-1)*100 redondeado
    "saldo_pendiente_total": 0,         // ya existe
    "facturas_pendientes": 0,           // ya existe (CONTEO)
    "facturas_vencidas": 0,             // ya existe
    "visitas_pendientes": 0,            // ya existe
    "paginas_impresas_mes": 0,          // NUEVO: SUM(readings.paginas_periodo) mes actual
    "stock_bajo": 0, "stock_critico": 0,// ya existen
    "valor_inventario": 0,              // ya existe
    "mantenimientos_pendientes": 0,     // ya existe
    "impresoras_en_mantenimiento": 0,   // ya existe
    "compras_vencidas": 0, "compras_por_vencer": 0 // ya existen
  },
  "impresoras_por_estado": { "RENTADA": 0, "EN_ALMACEN": 0, "EN_MANTENIMIENTO": 0, "DADA_DE_BAJA": 0 },
  "series": {                           // NUEVA sección
    "ingresos_6m":  [{ "mes": "YYYY-MM", "mes_nombre": "F Y", "total": 0 }],     // 6 meses
    "flujo_caja_6m":[{ "mes":"YYYY-MM","mes_nombre":"F Y","ingresos":0,"egresos":0,"flujo_neto":0,"acumulado":0 }],
    "top_rentabilidad": [{ "impresora_id":0,"codigo_negocio":"","modelo":"","ingresos":0,"costos":0,"margen":0,"roi":null }] // top 5, mes actual
  },
  "alertas": {                          // claves SIN CAMBIO (el front debe usar estas)
    "facturas_vencidas": [],            // [{id, razon_social, saldo_pendiente, fecha_vencimiento}]
    "visitas_proximas": [],             // [{visit_id, client, date}]
    "articulos_stock_bajo": [],         // [{id, nombre, stock_actual, umbral_reposicion, supplier?}]
    "mantenimientos_pendientes": [],    // [{id, printer_codigo, fecha, ...}]
    "compras_por_vencer": []            // [{id, proveedor, saldo_pendiente, fecha_vto_pago}]
  }
}
```

## Tareas

### A. Backend — refactor de `DashboardController`

**A1.** Extraer lógica reutilizable a servicios (evitar duplicar queries de reportes):
- Crear `app/Services/CashFlowService.php` con `getCashFlowSeries(int $meses = 6): array` moviendo la lógica actual de `FinanceReportController::cashFlow` (líneas 152–196).
- Crear `app/Services/ProfitabilityService.php` con `perPrinter(?string $inicio, ?string $fin): array` moviendo la lógica de `FinanceReportController::profitability` (líneas 20–79).
- Refactorizar `FinanceReportController` para que delegue en estos servicios (mismo output). Verificar que los endpoints de reportes siguen funcionando igual.

**A2.** En `DashboardController::__construct` inyectar los nuevos servicios.

**A3.** Añadir al `index()`:
- `paginas_impresas_mes`: `Reading::whereMonth('fecha', now()->month)->whereYear('fecha', now()->year)->sum('paginas_periodo')`.
- `tendencia_ingresos_pct`: `(ingresos_mes_anterior > 0) ? round((ingresos_mes/ingresos_mes_anterior - 1)*100, 1) : null`.
- `series.ingresos_6m`: loop 6 meses hacia atrás, `SUM(invoices.monto_total where estado != INCOBRABLE and fecha_emision in month)`.
- `series.flujo_caja_6m`: `$this->cashFlowService->getCashFlowSeries(6)`.
- `series.top_rentabilidad`: llamar `ProfitabilityService::perPrinter(now()->startOfMonth, now()->endOfMonth())`, mapear a `{impresora_id, codigo_negocio, modelo, ingresos, costos, margen, roi}`, `sortByDesc('margen')->take(5)`.
- Reusar `getInventoryValue()` de `ReportService` para `valor_inventario` (sustituye el cálculo inline actual) si reduce duplicación.

**A4.** (Opcional) Enriquecer `alertas.facturas_vencidas` con `saldo_pendiente` y `fecha_vencimiento` por factura, para que el widget del front muestre datos reales.

**Validación backend:** `docker compose exec app php artisan test` (y añadir/ajustar test del dashboard si existe). Verificar con `curl`/browser que `GET /api/v1/dashboard` devuelve todas las claves nuevas.

### B. Frontend — dependencias y tipos

**B1.** Añadir `recharts` a `frontend/package.json` (`npm install recharts` dentro del contenedor builder, o editando `package.json` + `docker compose run --rm --no-deps frontend npm install`).

**B2.** Reescribir el tipo `DashboardData` en `frontend/src/types/api.ts` con interfaces tipadas (no `Record<string, unknown[]>`): `DashboardKpis`, `DashboardSeries`, `IngresoMes`, `FlujoMes`, `PrinterRentabilidad`, `DashboardAlertas` con arrays de sus item types.

**B3.** Actualizar `frontend/src/hooks/useDashboard.ts` para retornar el nuevo tipo (sin cambios de lógica).

### C. Frontend — componentes de gráficas (nuevos, en `components/dashboard/charts/`)

Usar `recharts` + `ResponsiveContainer`, colores del tema (`primary/success/warning/destructive`), `formatCurrency` de `lib/formatters`. **Sin emojis. Sin comentarios.**

- **C1. `IngresosChart.tsx`** — `AreaChart` de `series.ingresos_6m` (eje X `mes_nombre`, valor `total`). Color `primary`. Tooltip con `formatCurrency`.
- **C2. `FlujoCajaChart.tsx`** — `ComposedChart`: `Bar` ingresos (verde), `Bar` egresos (rojo), `Line` `flujo_neto`. Datos `series.flujo_caja_6m`.
- **C3. `EstadoFlotaChart.tsx`** — `PieChart` donut de `impresoras_por_estado` (RENTADA/EN_ALMACEN/EN_MANTENIMIENTO/DADA_DE_BAJA) con leyenda y totales. Usar `getPrinterStatusColor` de `lib/formatters` para etiquetas.
- **C4.** Refactorizar `TopProfitabilityCard.tsx` para consumir `series.top_rentabilidad` (campos reales `margen`/`roi`) y añadir un `BarChart` horizontal opcional; eliminar el mapeo del campo inexistente.

### D. Frontend — nueva página `Dashboard.tsx`

**D1.** Eliminar todos los hardcodeos (`'Mayo 2026'`, `'5% vs mes anterior'`, `'Hoy (8 de mayo de 2026)'`).

**D2.** Calcular la tendencia real desde `kpis.tendencia_ingresos_pct` (signo → `up`/`down`/`neutral`).

**D3.** Corregir bugs de claves:
- `alertas.articulos_stock_bajo` (no `stock_bajo`).
- `alertas.visitas_proximas` (no `visitas_pendientes`).
- `kpis.facturas_pendientes` → mostrar como **conteo**, no currency.
- Eliminar referencias a `facturas_pendientes_detalles`, `visitas_hoy`, `top_impresoras` (no existen).

**D4.** Nuevo layout (role-adaptativo con `useTienePermiso`). Cada bloque condicional:

```
Row 1 — KPI cards (grid responsive sm:2 lg:3/4):
  • Ingresos del mes (+trend real)            — finanzas.facturas
  • Saldo por cobrar (saldo_pendiente_total)  — finanzas.cuentas-por-cobrar
  • Páginas impresas del mes                  — operaciones.lecturas
  • Flota en renta (rentada / total activo)   — inventario.impresoras
  • Valor de inventario                       — inventario.articulos
  • Mantenimientos pendientes                 — inventario.mantenimiento

Row 2 — charts (lg:grid-cols-2):
  • IngresosChart       — finanzas.facturas
  • EstadoFlotaChart    — inventario.impresoras

Row 3 — charts/series (lg:grid-cols-2):
  • FlujoCajaChart      — finanzas.flujo-caja
  • TopProfitabilityCard— finanzas.rentabilidad

Row 4 — listas operativas (lg:grid-cols-2):
  • Próximas visitas (visitas_proximas)  — operaciones.calendario  [PendingTasksList]
  • Facturas vencidas + por cobrar        — finanzas.facturas       [PendingTasksList]

Row 5 — alertas (lg:grid-cols-2/3):
  • Stock bajo/crítico (articulos_stock_bajo) — inventario.articulos   [AlertCard]
  • Compras por vencer                        — finanzas.cuentas-por-pagar [AlertCard]
  • Mantenimientos pendientes                 — inventario.mantenimiento [AlertCard]
```

**D5.** Mantener `PageLayout title="Dashboard"`, estados loading/error existentes, y el patrón `.filter(Boolean)` para KPIs.

**D6.** Conectar los `onViewAllClick`/`onActionClick` a navegación real (`useNavigate`) en vez de `console.log`:
- Facturas → `/finance/invoices`, Visitas → `/operations/calendar`, Rentabilidad → `/finance/reports/profitability`, Stock → `/inventory/articles`, Compras → `/finance/purchases`, Mantenimiento → `/inventory/maintenance`. (Confirmar rutas reales en `App.tsx` al implementar.)

### E. Rebuild y validación frontend

**E1.** Recompilar el dist en Docker: `docker compose run --rm --no-deps frontend sh -c "npm run build"`.
**E2.** Lint: `docker compose run --rm --no-deps frontend sh -c "npm run lint"`.
**E3.** Validar en `http://localhost:8080` con hard refresh (Ctrl+F5) como distintos usuarios: `admin@redprint.com` (todo visible) y `operador1@redprint.com` (solo widgets operativos).

## Riesgos y mitigaciones

- **Rendimiento del endpoint:** las series de 6 meses y el top rentabilidad añaden queries. Mitigar con índices existentes (fecha_emision, fecha, periodo_inicio) y, si hace falta, caché breve de la respuesta. El `top_rentabilidad` itera todos los printers; si la flota es grande, considerar límite/`take` temprano o caché.
- **Refactor de servicios:** al mover lógica de `FinanceReportController` a servicios, garantizar mismo output para no romper las páginas `ProfitabilityReport.tsx` y `CashFlowReport.tsx`. Ejecutar sus tests/verificar las páginas.
- **Recharts + bundle:** añade peso al bundle del SPA. Aceptable; confirmar que el `npm run build` no exceda límites.
- **`es_sistema` sin permisos:** `useTienePermiso` ya retorna `true` para system admin, así que verá todos los widgets sin cambios.

## Plan de validación

1. Backend: `docker compose exec app php artisan test` en verde; `GET /api/v1/dashboard` contiene `kpis.paginas_impresas_mes`, `series.*`, y todas las alertas.
2. Reportes sin regresión: abrir `/finance/reports/profitability` y `/finance/reports/cash-flow` y comprobar datos idénticos a antes del refactor.
3. Frontend: `npm run lint` sin errores; build correcto.
4. Manual: dashboard de admin muestra los 4 charts y todas las secciones; dashboard de operador solo muestra widgets permitidos; sin valores hardcodeados ni secciones vacías por claves erróneas.

## Archivos afectados (resumen)

- Backend: `app/Services/CashFlowService.php` (nuevo), `app/Services/ProfitabilityService.php` (nuevo), `app/Http/Controllers/FinanceReportController.php` (refactor delega), `app/Http/Controllers/DashboardController.php` (extiende).
- Frontend: `package.json`, `src/types/api.ts`, `src/components/dashboard/charts/{IngresosChart,FlujoCajaChart,EstadoFlotaChart}.tsx` (nuevos), `src/components/dashboard/TopProfitabilityCard.tsx`, `src/pages/dashboard/Dashboard.tsx`, `src/hooks/useDashboard.ts`.
