# 05 · Manual del Almacenista

**Para quién:** el encargado de almacén e inventario: recibe equipos y consumibles, los
ubica, controla el stock y mantiene el kardex al día.

**Permisos:** los del módulo Inventario — `inventario.impresoras`,
`inventario.articulos`, `inventario.almacenes`, `inventario.movimientos`. (El rol de
ejemplo `operador-inventario` trae los tres primeros.)

**Dónde:** panel web, menú **Inventario** (Impresoras, Artículos, Almacenes, Movimientos).

---

## Contenido

1. [Concepto: el kardex y el stock](#1-concepto-el-kardex-y-el-stock)
2. [Impresoras](#2-impresoras)
3. [Artículos e insumos](#3-artículos-e-insumos)
4. [Almacenes](#4-almacenes)
5. [Movimientos (kardex)](#5-movimientos-kardex)
6. [Recepción de compras](#6-recepción-de-compras)
7. [Reglas de oro del almacenista](#7-reglas-de-oro-del-almacenista)

---

## 1. Concepto: el kardex y el stock

Todo lo que entra y sale del inventario queda registrado en el **kardex** (movimientos):
cada movimiento guarda el **stock anterior y posterior**, el artículo, la cantidad y la
**referencia de origen** (compra, mantenimiento, entrega a cliente, ajuste manual).

Tipos de movimiento:

| Tipo | Cuándo nace | Color/delta |
|---|---|---|
| **ENTRADA** | Al recibir una compra con artículos | Verde `+` |
| **SALIDA** | Entregas a cliente (visitas), piezas al completar mantenimiento, salidas manuales | Rojo `−` |
| **AJUSTE** | Correcciones manuales de inventario | Según signo |

**El stock nunca puede quedar negativo**: el sistema valida la existencia disponible en
cada salida y protege la operación con bloqueos. Si intentas una salida mayor al stock,
el sistema la rechaza con un mensaje claro.

## 2. Impresoras

**Menú: Inventario -> Impresoras**

### Listado

- Tabla con búsqueda y **filtro por estado**: En almacén · Rentada · En mantenimiento ·
  Dada de baja.
- Acción **Nueva impresora** (modal): serie, marca/modelo (del catálogo), almacén,
  datos de vida útil/garantía, estado inicial.
- Clic en fila → detalle.

### Detalle de impresora

- **Ficha** con pestañas de información e **historial** (bitácora inmutable de todos sus
  cambios de estado: asignaciones, retiros, mantenimientos, con fechas y responsables).
- Muestra ubicación actual: almacén o contrato si está rentada.
- Acciones (administrador): **Editar**, **Desactivar** (modal con **razón obligatoria**) y
  **Eliminar**.

> **Baja ≠ eliminar (importante):** la operación normal para retirar un equipo
> definitivamente es la **baja/desactivación**, que conserva toda su historia (lecturas,
> órdenes, gastos). La **eliminación física** solo es posible si la impresora no tiene
> lecturas, órdenes, gastos, contratos ni detalles de factura; es una operación excepcional
> de limpieza. Nunca elimines para "corregir" un equipo con historia.

## 3. Artículos e insumos

**Menú: Inventario -> Artículos**

### Listado

- Cada artículo (CONSUMIBLE o REPARACIÓN) muestra su **estado de stock calculado**:
  - **Agotado** — stock 0.
  - **Bajo** — stock por debajo del **umbral de reposición**.
  - **OK** — stock suficiente.
- Acción **Nuevo artículo**: datos, proveedor, costo, **umbral de reposición** y stock
  inicial.
- Clic en fila → detalle.

### Detalle de artículo

- **Modelos compatibles**: multi-selector jerárquico marca → modelo. Defínelo bien: es la
  información con la que el operador y el técnico eligen qué insumo/pieza sirve para cada
  impresora.
- **Crear movimientos** de stock (entrada/salida/ajuste manual) — cada uno queda en el
  kardex.
- **Desactivar** (administrador) cuando el artículo deja de usarse.

> **Umbral de reposición:** el Dashboard alerta "stock bajo" comparando el stock actual
  contra este umbral. Revísalo cuando el uso real del artículo cambie.

## 4. Almacenes

**Menú: Inventario -> Almacenes**

- Listado con búsqueda, **filtro por estado** y **por responsable**, y conmutador
  **tabla/tarjeta**. **Nuevo almacén** (modal): nombre, responsable, estado.
- **Detalle**: estadísticas del almacén (equipos, valor, ocupación) y buscador de
  **impresoras dentro del almacén** con filtro por estado.
- Acciones: **Editar**, **Eliminar** (con confirmación).

Los almacenes son el destino natural de: impresoras liberadas de contratos (retiros),
equipos de nueva compra y equipos que salen de taller.

## 5. Movimientos (kardex)

**Menú: Inventario -> Movimientos**

- Historial completo de entradas/salidas/ajustes con **badges por tipo** y deltas
  coloreados (+/−).
- Clic en un movimiento → **modal de detalle** con stock anterior/posterior y
  **referencia cruzada** al hecho de origen: la compra que lo generó, la orden de
  mantenimiento que consumió la pieza, la entrega al cliente, etc.

**Uso típico:** auditar por qué bajó el stock de un artículo, rastrear una pieza hasta la
orden que la usó, o verificar una recepción de compra.

## 6. Recepción de compras

Cuando el área de compras (ver [capítulo finanzas](06-finanzas.md#5-compras-a-proveedores-y-cuentas-por-pagar))
registra una compra y la marca como **Recibida**, los artículos de sus detalles entran
automáticamente al stock del almacén correspondiente con movimientos de ENTRADA.

Como almacenista:

- Coordinadamente, **verifica físicamente** la mercancía contra el detalle de la compra
  antes/después de que se reciba en el sistema.
- Si hay diferencias, aplícalas con un **movimiento de AJUSTE** en el artículo, dejando
  la referencia/anotación de la compra.
- Consulta la trazabilidad en el kardex: cada ENTRADA referencia su compra de origen.

## 7. Reglas de oro del almacenista

1. **Todo movimiento debe verse en el kardex.** Si "arreglaste" un número por fuera del
   sistema, el inventario deja de ser confiable.
2. **Salidas siempre con referencia**: entrega, orden o ajuste justificado. El sistema
   no permite stock negativo: si te rechaza una salida, revisa el stock y el kardex.
3. **Los costos son evidencia**: el costo de cada pieza/entrega se congela al momento del
   movimiento; no se "actualiza" el histórico.
4. **Baja, no elimines** las impresoras con historia.
5. **Manten los umbrales de reposición al día**: de ellos nacen las alertas de stock bajo
   del Dashboard.
6. Modelos compatibles completos = menos errores de pedido y de entrega en campo.
