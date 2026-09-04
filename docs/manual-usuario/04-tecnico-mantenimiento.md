# 04 · Manual del Técnico de mantenimiento

**Para quién:** el técnico que repara y da mantenimiento a la flota, tanto desde el taller
(panel web) como en campo (app móvil).

**Permisos:** `inventario.mantenimiento` (imprescindible). Si también gestionas piezas:
`inventario.articulos` y `inventario.movimientos`.

**Dónde:** panel web, menú **Inventario -> Mantenimiento** y **Inventario -> Reportes
Mantenimiento**. En campo: app móvil (`/m/`), sección "Reportar falla" y "Completar orden".

---

## Contenido

1. [Concepto: la orden de mantenimiento](#1-concepto-la-orden-de-mantenimiento)
2. [Lista de órdenes](#2-lista-de-órdenes)
3. [Crear una orden (panel web)](#3-crear-una-orden-panel-web)
4. [Detalle de la orden y piezas usadas](#4-detalle-de-la-orden-y-piezas-usadas)
5. [Completar una orden](#5-completar-una-orden)
6. [Cancelar o editar una orden](#6-cancelar-o-editar-una-orden)
7. [Trabajo en campo (app móvil)](#7-trabajo-en-campo-app-móvil)
8. [Reportes de mantenimiento](#8-reportes-de-mantenimiento)
9. [Reglas de oro del técnico](#9-reglas-de-oro-del-técnico)

---

## 1. Concepto: la orden de mantenimiento

Cada trabajo de reparación/preventivo es una **orden** con estado:

```
PROGRAMADA → COMPLETADA | CANCELADA
```

| Campo | Descripción |
|---|---|
| **Tipo** | **Preventivo** (mantenimiento programado) o **Correctivo** (falla) |
| **Severidad** | Baja · Media · Alta · **Crítica** (notifica al instante a todos los usuarios con permiso de mantenimiento) |
| **Tipo de problema** | No imprime · Calidad deficiente · Atascos · Error en pantalla · Otro |
| **Descripción** | El problema reportado |
| **Piezas usadas** | Artículos consumidos por la orden (con el costo congelado al momento) |
| **Mano de obra** | Costo del trabajo en sí |
| **Costo total** | Calculado al completar: mano de obra + piezas |

**Efecto sobre la impresora (importante):**

- Una orden **correctiva** guarda el estado previo de la impresora y la pone en
  **EN MANTENIMIENTO**; al completar o cancelar, la **restaura** a ese estado previo
  (con criterio: si el estado cambió mientras tanto, conserva el actual y lo anota en el
  historial).
- Una orden **preventiva** no cambia el estado de la impresora.

## 2. Lista de órdenes

**Menú: Inventario -> Mantenimiento**

- **Filtros**: estado (Programada / Completada / Cancelada), tipo (Preventivo /
  Correctivo), severidad y tipo de problema.
- **KPIs** del encabezado: órdenes abiertas, costos, etc.
- Clic en una fila → detalle de la orden.

## 3. Crear una orden (panel web)

**Inventario -> Mantenimiento -> Nueva orden**:

1. **Busca la impresora** por serie/modelo.
2. Elige el **tipo** (Preventivo/Correctivo) y, si es correctivo, el **tipo de problema**.
3. Elige la **severidad** (recuerda: Crítica notifica de inmediato).
4. Describe el problema.
5. **Adjunta fotos** si tienes evidencia (se comprimen automáticamente).
6. Confirma. La orden nace en **PROGRAMADA**.

> También puedes crear órdenes correctivas automáticamente al retirar una impresora por
> falla desde la app móvil (casilla *"Crear orden correctiva"*) — ver
> [capítulo del operador](03-operador-campo.md#8-retirar-una-impresora).

## 4. Detalle de la orden y piezas usadas

En el detalle de una orden **PROGRAMADA** puedes:

- **Agregar/quitar artículos (piezas)**:
  - El sistema valida contra el **stock acumulado** de la orden: la suma de las piezas ya
    registradas más la nueva no puede exceder el stock actual del artículo.
  - El **costo de cada pieza se congela** al valor del momento (si el precio cambia después,
    la orden conserva el histórico).
- Ver el problema, fotos, impresora, costos acumulados y su historial.

> Solo en estado **PROGRAMADA** se pueden agregar piezas y editar la orden.

## 5. Completar una orden

**Detalle de la orden -> Completar** (con confirmación). En una sola operación, el sistema:

1. Calcula el **costo total** (mano de obra + piezas).
2. Estampa la fecha de completado.
3. **Descarga del stock** las piezas registradas (nace el movimiento de kardex).
4. **Restaura la impresora** a su estado previo (si aplica).

Después de completada, la orden queda como evidencia permanente y sus costos alimentan la
**rentabilidad por impresora y contrato**.

## 6. Cancelar o editar una orden

- **Editar**: solo en estado PROGRAMADA.
- **Cancelar**: quita las piezas registradas **sin tocar el stock** (nunca hubo salida,
  porque la salida solo ocurre al completar). Úsala cuando el trabajo no procede o se
  duplicó.
- Las órdenes completadas o canceladas **no se editan** (son historial).

## 7. Trabajo en campo (app móvil)

El técnico con acceso a la app móvil (`/m/`) puede, **requiere conexión**:

**Reportar una falla** (crea orden correctiva desde el cliente):

1. En la visita → impresora → **⚠️ Reportar falla**.
2. Tipo de problema, severidad, descripción (obligatoria) y foto opcional.
3. **Reportar falla**: la orden queda vinculada a la visita y la impresora pasa a taller.

**Completar una orden en campo**:

1. En la visita (o el detalle de la impresora) localiza la orden PROGRAMADA →
   **Completar orden**.
2. Captura el **trabajo realizado** (obligatorio), el **costo de mano de obra** y el
   **contador al terminar** (importante: actualiza el contador del taller para **no
   facturar las páginas de prueba** al reingresar el equipo).
3. **Completar orden**.

> Completar la orden **no cierra la visita**: el cierre de la visita siempre es explícito.

## 8. Reportes de mantenimiento

**Menú: Inventario -> Reportes Mantenimiento**

- **Top 10 impresoras problemáticas**: equipos con más órdenes/costos; ayuda a decidir
  rotaciones o bajas.
- **Costo de mantenimiento por número de serie**: busca una serie y consulta su costo
  histórico de mantenimiento.
- Exportación disponible en pantalla.

## 9. Reglas de oro del técnico

1. **Registra las piezas en la orden antes de completar**: al completar se descargan de
   stock; si falta una pieza, agrégala antes, no después.
2. **Completa la orden solo cuando el trabajo terminó**: el completado es definitivo.
3. **Cancela sin miedo**: cancelar no toca stock ni impresoras; es la salida limpia para
   órdenes duplicadas o desistidas.
4. **Captura el "contador al terminar"** en taller: evita facturar páginas de prueba al
   cliente.
5. Severidad **Crítica** = alerta inmediata: úsala solo para fallas reales que detienen al
   cliente.
6. Los costos de tus órdenes alimentan la rentabilidad del negocio: mano de obra y piezas
   completos = reportes confiables.
