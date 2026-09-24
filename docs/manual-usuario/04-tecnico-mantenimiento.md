# 04 · Manual del Técnico de mantenimiento

**Para quién:** el técnico que repara y da mantenimiento a la flota, tanto desde el taller
(panel web) como en campo (app móvil).

**Permisos:** `inventario.mantenimiento` (imprescindible). Si también gestionas piezas:
`inventario.articulos` y `inventario.movimientos`.

**Dónde:** panel web, menú **Inventario -> Taller** (tu pantalla de inicio), **Inventario ->
Mantenimiento** y **Inventario -> Reportes Mantenimiento**. En campo: app móvil (`/m/`),
sección "Reportar falla" y "Completar orden".

---

## Contenido

1. [Concepto: la orden de mantenimiento](#1-concepto-la-orden-de-mantenimiento)
2. [Concepto: condición técnica de la impresora](#2-concepto-condición-técnica-de-la-impresora)
3. [Panel Taller](#3-panel-taller)
4. [Lista de órdenes](#4-lista-de-órdenes)
5. [Crear una orden (panel web)](#5-crear-una-orden-panel-web)
6. [Detalle de la orden y piezas usadas](#6-detalle-de-la-orden-y-piezas-usadas)
7. [Completar una orden](#7-completar-una-orden)
8. [Cancelar o editar una orden](#8-cancelar-o-editar-una-orden)
9. [Planes de mantenimiento preventivo](#9-planes-de-mantenimiento-preventivo)
10. [Trabajo en campo (app móvil)](#10-trabajo-en-campo-app-móvil)
11. [Reportes de mantenimiento](#11-reportes-de-mantenimiento)
12. [Reglas de oro del técnico](#12-reglas-de-oro-del-técnico)

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
| **Piezas usadas** | Artículos consumidos por la orden (costo y origen congelados al momento) |
| **Mano de obra** | Costo del trabajo en sí |
| **Costo total** | Calculado al completar: mano de obra + piezas |

**Efecto sobre la impresora (importante):**

- Una orden **correctiva** guarda el estado previo de la impresora y la pone en
  **EN MANTENIMIENTO**; al completar o cancelar, la **restaura** a ese estado previo
  (con criterio: si el estado cambió mientras tanto, conserva el actual y lo anota en el
  historial).
- Una orden **preventiva** no cambia el estado de la impresora.
- Las órdenes también actualizan la **condición técnica** automáticamente (ver cap. 2).

## 2. Concepto: condición técnica de la impresora

Además del estado comercial (En almacén / Rentada / En taller / Dada de baja), cada
impresora tiene una **condición técnica** que responde "cómo está el equipo":

| Condición | Significado |
|---|---|
| **Operativa** | Funciona; lista para rentar o trabajando bien |
| **Requiere atención** | Funciona con fallas leves o necesita revisión. **No bloquea** la renta |
| **No operativa** | Fallada; no se puede instalar ni rentar |
| **Para piezas (donante)** | Descartada para deshuese; nunca se vuelve a rentar |

Las impresoras legadas pueden estar **sin condición** hasta que una orden o un cambio
manual se la asigne.

**Dónde se ve y se cambia:**

- Columna, filtro y chip de condición en el **catálogo de impresoras**.
- En la **ficha de la impresora**, la tarjeta de condición muestra el detalle (nota y
  fecha del último cambio) y permite el cambio **manual** — solo administradores, con
  nota obligatoria. Todo cambio queda en el historial de la impresora.

**Transiciones automáticas (no dependen de la memoria de nadie):**

- Crear una orden **correctiva de severidad Alta/Crítica** → la impresora pasa a
  **No operativa**.
- Crear una correctiva **Baja/Media** → pasa a **Requiere atención**.
- **Completar** una orden → vuelve a **Operativa**, salvo que marques
  *"queda para piezas"* al completar (ver cap. 7).
- Las donantes (**Para piezas**) nunca cambian de condición solas.

**Reglas de negocio derivadas:**

- **No se puede asignar a contrato** una impresora No operativa ni Para piezas
  (el sistema lo rechaza). *Requiere atención* solo **advierte** en el asistente:
  renting y servicio en la primera visita es una decisión consciente del negocio.
- En la app móvil, la instalación filtra las No operativas/Para piezas y avisa
  de las que Requieren atención.

**Flujo de deshuese (donante):**

1. El equipo falla de forma grave o antieconómica y queda en almacén.
2. Al **completar** la orden, marca *"queda para piezas"* → condición **Para piezas**.
3. Desde la ficha de la impresora puedes **extraer piezas** del donante: cada pieza
   extraída **ingresa al inventario** como artículo refaccionado (kardex normal).
4. Cuando ya no queda valor: **Dar de baja** (flujo existente).

## 3. Panel Taller

**Menú: Inventario -> Taller** — la pantalla de inicio del técnico. Resume la salud de la
flota y tu cola de trabajo (se actualiza cada 5 minutos):

- **KPIs de cabecera**: No operativas · Requieren atención · En taller · Disponibles para
  renta · Donantes de piezas · Sin condición.
- **Cola del taller**: órdenes PROGRAMADAS ordenadas por severidad y antigüedad (días
  desde su creación). Incluye las impresoras **No operativas sin orden abierta**, para
  que no se queden esperando que alguien la cree.
- **Disponibilidad de flota**: matriz estado × condición — cuántas impresoras puedes
  rentar y cuántas son candados.
- **Piezas del técnico**: artículos de reparación bajo el umbral de stock.
- **Productividad del mes**: servicios completados, tiempos de resolución (MTTR) y
  porcentaje de correctivas.
- **Preventivos vencidos y próximos** con acceso directo a los
  [planes](#9-planes-de-mantenimiento-preventivo).

## 4. Lista de órdenes

**Menú: Inventario -> Mantenimiento**

- **Filtros**: estado (Programada / Completada / Cancelada), tipo (Preventivo /
  Correctivo), severidad y tipo de problema.
- **KPIs** del encabezado: órdenes abiertas, costos, etc.
- Clic en una fila → detalle de la orden.
- Botón **Planes** → administración de planes preventivos (cap. 9).

## 5. Crear una orden (panel web)

**Inventario -> Mantenimiento -> Nueva orden**:

1. **Busca la impresora** por serie/modelo.
2. Elige el **tipo** (Preventivo/Correctivo) y, si es correctivo, el **tipo de problema**.
3. Elige la **severidad** (recuerda: Crítica notifica de inmediato y marca la impresora
   como No operativa).
4. Describe el problema.
5. **Adjunta fotos** si tienes evidencia (se comprimen automáticamente).
6. Confirma. La orden nace en **PROGRAMADA**.

> También puedes crear órdenes correctivas automáticamente al retirar una impresora por
> falla desde la app móvil (casilla *"Crear orden correctiva"*) — ver
> [capítulo del operador](03-operador-campo.md#8-retirar-una-impresora).

## 6. Detalle de la orden y piezas usadas

En el detalle de una orden **PROGRAMADA** puedes:

- **Agregar/quitar artículos (piezas)**:
  - El sistema valida contra el **stock acumulado** de la orden: la suma de las piezas ya
    registradas más la nueva no puede exceder el stock actual del artículo.
  - El **costo y el origen** de cada pieza se **congelan** al valor del momento (si el
    precio o la clasificación cambian después, la orden conserva el histórico).
- Ver el problema, fotos, impresora, costos acumulados y su historial. Cada pieza usada
  muestra su **origen**: Original / Compatible / Refaccionada (las refaccionadas provienen
  de donantes de deshuese).

> Solo en estado **PROGRAMADA** se pueden agregar piezas y editar la orden.

## 7. Completar una orden

**Detalle de la orden -> Completar** (con confirmación). En una sola operación, el sistema:

1. Calcula el **costo total** (mano de obra + piezas).
2. Estampa la fecha de completado.
3. **Descarga del stock** las piezas registradas (nace el movimiento de kardex).
4. **Restaura la impresora** a su estado previo (si aplica).
5. Actualiza la **condición técnica** a Operativa — salvo que marques la casilla
   **"queda para piezas"**, que la marca como donante (cap. 2).
6. Si la orden era **preventiva de un plan**, recalcula el próximo vencimiento del plan
   (cap. 9).

Después de completada, la orden queda como evidencia permanente y sus costos alimentan la
**rentabilidad por impresora y contrato** y los **reportes de mantenimiento** (cap. 11).

## 8. Cancelar o editar una orden

- **Editar**: solo en estado PROGRAMADA.
- **Cancelar**: quita las piezas registradas **sin tocar el stock** (nunca hubo salida,
  porque la salida solo ocurre al completar). Úsala cuando el trabajo no procede o se
  duplicó.
- Las órdenes completadas o canceladas **no se editan** (son historial).

## 9. Planes de mantenimiento preventivo

**Inventario -> Mantenimiento -> botón Planes** (o desde el panel Taller). Resuelven el
"preventivo cada N meses" que antes dependía de la memoria.

**Qué es un plan:**

- Se define **por modelo** (default para toda la flota del modelo) o **por impresora**
  (excepción puntual).
- **Periodicidad en meses** y/o **en páginas** (se toma el que venza primero, usando el
  contador actual de la impresora).
- **Ventana de aviso** (por defecto 15 días): con cuánta anticipación aparece como
  "próximo".

**Bandeja de sugerencias (nada se crea solo):**

- El sistema calcula diariamente (a las 02:00) qué planes están **próximos o vencidos**.
- La bandeja considera **solo impresoras rentadas** (instaladas en clientes). Las impresoras
  en almacén no generan sugerencias, pero su plan sigue corriendo: al instalarse llega con
  el histórico acumulado (se verá cuánto tiempo sin servicio, incluidos equipos en clientes
  lejanos o fuera de cobertura).
- La bandeja los lista con su fecha/contador de vencimiento; tú decides:
  **crear la orden** preventiva individualmente o **crear todas** en lote.
- Las órdenes nacen PROGRAMADA con la fecha de vencimiento; al completarlas, el plan
  recalcula el próximo servicio desde la fecha real de completado.

> El guard anti-duplicado impide dos órdenes abiertas para la misma impresora: si ya hay
> una orden abierta, el plan espera.

## 10. Trabajo en campo (app móvil)

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

**Instalaciones y condición:** al elegir impresora para instalar, la app oculta las
No operativas y Para piezas, y advierte sobre las que Requieren atención.

> Completar la orden **no cierra la visita**: el cierre de la visita siempre es explícito.

## 11. Reportes de mantenimiento

**Menú: Inventario -> Reportes Mantenimiento**

Todos los reportes aceptan un **rango de fechas** (desde/hasta) para analizar por
periodo, no solo el mes corriente:

- **Impresoras problemáticas**: equipos con más órdenes/costos; ayuda a decidir
  rotaciones o bajas.
- **Costo de mantenimiento por número de serie**: busca una serie y consulta su costo
  histórico de mantenimiento.
- **Piezas más usadas**: ranking de artículos consumidos en órdenes completadas (útil
  para compras), con **desglose por origen** (Original / Compatible / Refaccionada) —
  la base para decidir si los compatibles rinden como los originales.
- **Ranking de fallas**: agregación por tipo de problema y modelo — identifica "el modelo
  que se atasca" — con las **piezas asociadas** a cada tipo de falla (qué kit resuelve
  cada problema).
- Exportación disponible en pantalla.

## 12. Reglas de oro del técnico

1. **Registra las piezas en la orden antes de completar**: al completar se descargan de
   stock; si falta una pieza, agrégala antes, no después.
2. **Completa la orden solo cuando el trabajo terminó**: el completado es definitivo.
3. **Marca el resultado real al completar**: si el equipo queda como donante, marca
   *"queda para piezas"* — la condición alimenta la disponibilidad de flota del Taller.
4. **Cancela sin miedo**: cancelar no toca stock ni impresoras; es la salida limpia para
   órdenes duplicadas o desistidas.
5. **Captura el "contador al terminar"** en taller: evita facturar páginas de prueba al
   cliente.
6. Severidad **Crítica** = alerta inmediata y No operativa: úsala solo para fallas
   reales que detienen al cliente.
7. **Revisa la bandeja de planes**: los preventivos no se crean solos; el Taller y la
   bandeja te dicen qué vence.
8. Los costos de tus órdenes alimentan la rentabilidad del negocio: mano de obra y
   piezas completos = reportes confiables.
