# 06 · Manual de Administración financiera

**Para quién:** el contador o responsable administrativo que factura, cobra, paga
proveedores, concilia el banco y cierra el periodo.

**Permisos:** los del módulo Finanzas (`finanzas.*`): Facturas, CFDI, Cuentas por Cobrar,
Cuentas por Pagar, Compras, Rentabilidad, Flujo de Caja, Cuentas Bancarias, Conciliación y
Cierre de Periodo.

**Dónde:** panel web, menú **Finanzas**.

---

## Contenido

1. [Visión general del ciclo financiero](#1-visión-general-del-ciclo-financiero)
2. [Facturación](#2-facturación)
3. [Cobranza: cuentas por cobrar y pagos](#3-cobranza-cuentas-por-cobrar-y-pagos)
4. [Comprobantes CFDI (XML)](#4-comprobantes-cfdi-xml)
5. [Compras a proveedores y cuentas por pagar](#5-compras-a-proveedores-y-cuentas-por-pagar)
6. [Cuentas bancarias y conciliación](#6-cuentas-bancarias-y-conciliación)
7. [Cierre de periodo](#7-cierre-de-periodo)
8. [Reportes: rentabilidad y flujo de caja](#8-reportes-rentabilidad-y-flujo-de-caja)
9. [Reglas de oro de finanzas](#9-reglas-de-oro-de-finanzas)

---

## 1. Visión general del ciclo financiero

```
lecturas de campo → facturas (por lecturas o manuales) → pagos de clientes
→ conciliación bancaria → cierre de periodo
   ↳ compras a proveedores → recepción (entra stock) → pagos a proveedores
   ↳ CFDI: importar XML timbrado, casar con cliente (RFC) y vincular a factura
```

Contexto fiscal México: moneda MXN (cuentas bancarias pueden ser USD), CFDI **importados**
(el timbrado se hace en otra herramienta; RedPrint **no emite** CFDI hacia el SAT). Solo
los CFDI de tipo **ingreso (I)** generan/vinculan facturas.

---

## 2. Facturación

**Menú: Finanzas -> Facturas**

### 2.1 Crear una factura (asistente de 3 pasos)

**Facturas -> Nueva factura**:

1. **Datos generales**
   - Cliente, **destino** (guardar como **borrador** o **emisión directa**) y
     **método de cálculo**:
     - **Por lecturas**: el sistema arma las líneas a partir de las lecturas no facturadas
       de los equipos del cliente dentro del periodo.
     - **Manual**: capturas el periodo y las líneas.
   - **Periodo** (fecha inicio/fin).
2. **Impresoras y contratos** — selecciona equipos/contratos a incluir.
3. **Revisión** — vista previa de líneas y montos; confirma.

> **El servidor recalcula todo:** aunque la pantalla muestre estimaciones, al emitir el
> sistema **recalcula los montos** con sus propias reglas. La vista previa además muestra
> **advertencias** (lecturas sin contrato, contratos sin lecturas, periodos solapados):
> resuélvelas antes de emitir, no las ignores.

**Reglas de protección (el sistema las aplica solo):**

- Una **lectura se factura a lo sumo una vez** (aunque se repita el intento).
- No se permite ** doble cobro del mismo periodo** para un cliente (periodos solapados,
  incluso entre borradores).
- Cada línea de detalle distribuye el monto del contrato de forma proporcional y el
  redondeo se absorbe en la última fila (Σ detalles = total exacto).

### 2.2 Facturación por ciclos del contrato (recomendada)

Desde **Contratos -> detalle -> Facturación** puedes ver los **ciclos** del contrato
(cada uno anclado al aniversario de su fecha de inicio) y generar **borradores por lote**:
un borrador por ciclo pendiente, conservando la tarifa base y páginas incluidas de cada
ciclo.

Comportamiento clave de los ciclos:

- **Lectura de corte**: la última lectura dentro de la ventana
  `fin de ciclo − 5 días … fin + días de gracia` cierra el ciclo.
- **Ciclo sin lectura de corte**: se cobra solo la **tarifa base** y el paquete de páginas
  se **acumula** para el siguiente ciclo con lectura (se compara el consumo del hueco
  completo contra el paquete acumulado). No se pierde consumo.

### 2.3 Detalle de factura

- Líneas con **páginas consumidas y monto calculado por impresora**.
- **Acciones**: **Registrar pago**, **Vincular/Desvincular CFDI**, **Importar CFDI**,
  **Emitir** (si es borrador), **Recalcular**, **Eliminar**.

Estados: `PENDIENTE → PARCIALMENTE_PAGADA → PAGADA` (+ `VENCIDA`, `INCOBRABLE`).

---

## 3. Cobranza: cuentas por cobrar y pagos

### Cuentas por cobrar

**Menú: Finanzas -> Cuentas por Cobrar**

- Listado de facturas con saldo, **días vencidos con semáforo** (15/30 días) y KPIs de
  saldo total.
- **Registrar pago** desde el modal: fecha, monto, método y quién registra.

### Pagos (movimientos)

**Menú: Finanzas -> Cuentas por Pagar** — lista los pagos registrados (de clientes y a
proveedores) con su cuenta bancaria asociada y total acumulado.

Reglas: cada pago debe ser `0 < monto ≤ saldo` (sin sobrepagos); el estado de la factura
se actualiza automáticamente; los pagos son la materia prima de la conciliación.

> **Facturas vencidas:** el estado `VENCIDA` se evalúa por fecha de vencimiento. Revisa
> periódicamente la lista de vencidas (el Dashboard las destaca) y da seguimiento de
> cobranza.

---

## 4. Comprobantes CFDI (XML)

**Menú: Finanzas -> Comprobantes CFDI**

El flujo con el SAT: la empresa **timbra fuera del sistema** y aquí se **importan los XML**
ya timbrados.

- **Importar CFDI**: carga del XML. La importación es idempotente por UUID (si ya existía,
  se marca como duplicado, no se duplica el registro).
- Estados derivados:
  - **Cliente**: `sin cliente` / `asignado` — el match es por **RFC exacto**; un CFDI con
    RFC desconocido **no crea clientes**: queda pendiente de **Asignar cliente** a mano
    (señal de datos sucios, no error).
  - **Factura**: `sin factura` / `conciliado` — vínculo 1:1 con una factura interna.
- **Generar factura desde CFDI** (solo tipo ingreso `I`) o **Vincular a factura existente**
  (por serie + folio = número de factura).
- Filtros por tipo, estado de conciliación y estado de cliente; **Eliminar**.

> Recomendación: importa los CFDI apenas estén timbrados y vincúlulos a sus facturas antes
> del cierre de periodo (el cierre verifica conciliación pendiente).

---

## 5. Compras a proveedores y cuentas por pagar

**Menú: Finanzas -> Compras**

- **Nueva compra** (modal): proveedor, artículos, cantidades y costos; método de pago
  (Contado / Crédito / Parcial).
- **Recibir**: al marcar la compra como recibida, los artículos con detalle entran al
  **stock del almacén** (coordínate con el almacenista, ver
  [capítulo 5](05-almacenista.md#6-recepción-de-compras)). Una compra recibida ya no se
  puede cancelar.
- **Cancelar**: solo compras pendientes.
- Detalle con pestañas de artículos/estado; **pagos a proveedores** desde el detalle; las
  compras con saldo forman las **cuentas por pagar** (visibles también en el Dashboard).

Estados: `PENDIENTE → RECIBIDA | CANCELADA`.

---

## 6. Cuentas bancarias y conciliación

### Cuentas bancarias

**Menú: Finanzas -> Cuentas Bancarias**

- **Nueva cuenta**: banco, tipo (Cheques/Débito/Ahorro), **moneda (MXN o USD)**, número de
  cuenta y saldo inicial.
- Movimientos por cuenta con etiquetas de conciliación.

### Conciliación

**Menú: Finanzas -> Conciliación**

La conciliación es **manual** (no hay importación de estados de cuenta bancarios):

1. Selecciona **cuenta + periodo**.
2. El sistema lista los movimientos con estado **Conciliado / Pendiente / No conciliado**
   y un **resumen de diferencias**.
3. **Vincular movimiento**: enlaza el movimiento bancario con el pago registrado en el
   sistema (de cliente o proveedor). El movimiento pasa a **CONCILIADO**.
4. Exporta / envía por correo el resultado.

> Objetivo: que el resumen de diferencias quede en cero (o explicado) antes del cierre.

---

## 7. Cierre de periodo

**Menú: Finanzas -> Cierre de Periodo**

Corte mensual con **snapshot de KPIs** (margen, ROI, etc.) y validaciones previas:

1. El panel muestra el periodo vigente y el estado de las **validaciones** (modal de
   detalle): facturas pendientes, conciliación pendiente, rentabilidad negativa
   (esta última es **bloqueante**).
2. Corrige lo señalado (emitir pendientes, conciliar, revisar rentabilidad).
3. Cierra con la **aceptación explícita de términos** (checkbox obligatorio) — el cierre
   es **irreversible**.
4. Consulta el **historial de cierres** y el reporte del periodo.

> **Advertencias honestas:** el cierre **no congela la escritura** del periodo (se podrían
  registrar operaciones con fechas de un periodo ya cerrado y el snapshot quedaría
  desfasado); además hay **un solo cierre por mes** (`AAAA-MM` único). Cierra solo cuando
  el mes esté completo y conciliado.

---

## 8. Reportes: rentabilidad y flujo de caja

### Rentabilidad

**Menú: Finanzas -> Rentabilidad**

- Filtro por periodo y **vista por impresora o por cliente**.
- Totales de **ingresos, costos y rentabilidad**. Los ingresos provienen de lo realmente
  facturado (detalles de factura), y los costos suman mantenimiento, gastos e insumos
  entregados. Sirve para decidir renegotiaciones, rotaciones y bajas de equipos.

### Flujo de caja

**Menú: Finanzas -> Flujo de Caja**

- Filtro por periodo; comparativo **mes actual vs. anterior**.
- Desglose de ingresos/egresos por categoría (cobranza, compras, pagos, etc.).
- **Exportación** disponible.

> **Nota de versión actual:** parte de las gráficas de estos reportes aún se apoyan en
> datos de ejemplo; verifica los totales contra los módulos fuente antes de tomar
> decisiones críticas (ver [FAQ](07-preguntas-frecuentes.md)).

---

## 9. Reglas de oro de finanzas

1. **Factura con lecturas de corte presentes.** Verifica en cada contrato que la lectura
   del fin de ciclo llegó (ventana −5/+gracia) antes de emitir su factura del ciclo.
2. **Lee las advertencias de la vista previa**: están ahí para evitar doble cobro o
   periodos mal medidos.
3. **Un CFDI, una factura** (y viceversa): vínculalos siempre que existan.
4. **Sin sobrepagos**: si el cliente paga de más, registra el monto exacto al saldo.
5. **Concilia antes de cerrar**: el cierre es irreversible y su snapshot es tu historial.
6. **Nunca reescribas el pasado**: los montos históricos (costos de piezas, entregas)
   están congelados a propósito; una corrección se hace con un pago/nota nuevo, no
   editando historia.
