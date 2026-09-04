# 01 · Conceptos básicos del negocio

Antes de usar el sistema conviene entender **cómo gana dinero la empresa** y qué significa
cada concepto. Este capítulo es la base común para todos los roles.

---

## El negocio en una fórmula

La empresa no vende impresoras: **las renta**. Instala equipos en oficinas de clientes bajo
contrato, lee periódicamente los contadores de páginas y cobra:

```
monto a cobrar = tarifa_base + máximo(0, páginas_del_periodo − páginas_incluidas) × costo_por_página_excedente
```

Es decir: cada contrato tiene una **renta fija** (`tarifa base`) que incluye un paquete de
**páginas gratuitas**; si el cliente imprime más, cada página extra se cobra al precio del
**excedente**. Todo lo demás en el sistema existe para sostener esa fórmula:

```
comprar equipos e insumos → almacenar → contratar con clientes → asignar impresoras
→ visitar y leer contadores → facturar consumo → cobrar → conciliar banco → cerrar periodo
   ↳ mantener/reparar equipos (con stock de piezas) → rotar impresoras (instalar/retirar)
```

---

## Glosario esencial

| Término | Significado |
|---|---|
| **Socio** | Técnico/operador asignado a una visita (el que va al cliente) |
| **Contrato** | Acuerdo con el cliente: precio (tarifa base, páginas incluidas, excedente), frecuencia de visitas, vigencia y estado |
| **Ciclo (de facturación)** | Periodo mensual del contrato que arranca en el aniversario de su fecha de inicio (ej. inicio 20-ago → ciclo 20-ago…19-sep). Es la unidad de cobro |
| **Lectura** | Valor del contador de páginas de una impresora, capturado durante una visita |
| **Páginas del periodo** | Diferencia entre la lectura actual y la anterior. Es lo que se cobra |
| **Lectura de corte** | Última lectura del ciclo tomada cerca de su fin (dentro de la ventana de cierre). Cierra el ciclo para facturación |
| **Días de gracia de lectura** | Días después del fin del ciclo en los que una lectura tardía todavía cierra ese ciclo |
| **Anomalía** | Lectura cuyo contador es menor al anterior (el contador "retrocedió") o da un salto atípico. Exige **justificación obligatoria** |
| **Visita** | Unidad de trabajo de campo: leer contadores, entregar insumos, instalar/retirar equipos, mantenimiento |
| **Insumo / artículo** | Consumible (tóner, tinta) o pieza de reparación. Tienen stock, umbral de reposición y compatibilidad con modelos de impresora |
| **Kardex** | Historial de movimientos de inventario (entradas, salidas, ajustes) con el stock anterior y posterior de cada movimiento |
| **CFDI** | Comprobante fiscal digital (XML del SAT, México). Se **importa** al sistema (la empresa timbra con otra herramienta) |
| **Cuentas por cobrar / pagar** | Facturas de clientes / compras de proveedores con saldo pendiente |
| **Conciliación** | Cruce manual entre los movimientos del banco y los pagos registrados en el sistema |
| **Cierre de periodo** | Corte mensual con snapshot de indicadores; valida que todo esté en orden antes de cerrar |
| **Registro de campo** | Captura de una visita a un cliente o impresora que **no existen en el sistema**; se toma como evidencia y luego un administrador la "regulariza" (vincula a datos reales o la descarta) |
| **Flota** | Conjunto de impresoras de la empresa |

---

## Estados de las principales entidades

Las entidades del sistema siguen máquinas de estado: no se puede saltar de un estado a
cualquier otro. Reconocer los estados (y sus colores en la interfaz) es parte del trabajo
diario.

### Impresora

```
EN ALMACÉN → RENTADA → EN MANTENIMIENTO → DADA DE BAJA
```

| Estado | Significado |
|---|---|
| **En almacén** | Disponible en un almacén; puede asignarse a un contrato |
| **Rentada** | Instalada en un cliente bajo contrato activo |
| **En mantenimiento** | En taller (por falla o mantenimiento); en algunos casos sigue asignada al contrato |
| **Dada de baja** | Fuera de operación definitiva. No hay retorno |

Reglas prácticas:

- Solo se asigna a un contrato desde **En almacén** y si no tiene otro contrato activo.
- Una impresora rentada **no se da de baja directamente**: primero se libera al almacén.
- **Baja ≠ eliminar**: la baja conserva toda la historia. Eliminar físicamente es una
  operación excepcional que el sistema solo permite si la impresora no tiene lecturas,
  órdenes, gastos ni contratos asociados.
- Cada cambio de estado queda registrado para siempre en el **historial** de la impresora.

### Contrato

| Estado | Significado |
|---|---|
| **Activo** | Vigor: genera visitas y se factura |
| **Suspendido** | Pausado temporalmente |
| **Finalizado** | Terminó su vigencia (se liberan las impresoras) |
| **Cancelado** | Terminó antes de tiempo (se liberan las impresoras) |

- Al crear un contrato, el sistema genera su **primera visita automáticamente** en la misma
  operación.
- Finalizar o cancelar cancela las visitas futuras pendientes y devuelve las impresoras al
  almacén.

### Visita

| Estado | Significado |
|---|---|
| **Pendiente** | Programada, esperando al operador |
| **Completada** | Cerrada con actividades (o con motivo de cierre). Ya **no puede modificarse** |
| **Reprogramada** | Se movió de fecha |
| **Cancelada** | Cancelada por término de contrato; el calendario **puede volver a generarla** si el contrato se reactiva |
| **Omitida** | El operador/administrador descartó ese espacio a propósito; el calendario **no la vuelve a generar** |

Reglas prácticas:

- **El cierre de una visita es siempre explícito**: ni capturar todas las lecturas ni
  instalar/retirar equipos la cierran solos. Debe pulsarse **Completar visita**.
- Si al cerrar no hubo ninguna actividad, el sistema exige un **motivo de cierre**.
- Solo se puede capturar/cerrar una visita en estado abierto (Pendiente/Reprogramada) y
  programada a **5 días o menos en el futuro** (adelantarse más "quema" el espacio del ciclo).
- El **tipo de visita** (lectura, instalación, retiro, entrega, mantenimiento) es el *motivo
  principal*, no una restricción: en una visita abierta se puede hacer cualquier actividad
  para la que se tenga permiso.

### Orden de mantenimiento

```
PROGRAMADA → COMPLETADA | CANCELADA
```

- Solo una orden **Programada** se puede editar y recibir piezas.
- **Completar** calcula el costo total (mano de obra + piezas), descuenta las piezas del
  stock y devuelve la impresora a su estado previo.
- **Cancelar** quita las piezas registradas **sin tocar el stock**.

### Factura

```
PENDIENTE → PARCIALMENTE PAGADA → PAGADA      (+ VENCIDA, INCOBRABLE)
```

- Cada pago actualiza montos y estado automáticamente; no se aceptan sobrepagos.
- **Vencida** se marca según la fecha de vencimiento.

### Compra a proveedor

```
PENDIENTE → RECIBIDA | CANCELADA
```

- Solo al **recibir** la compra los artículos entran al stock del almacén.
- Una compra recibida no se puede cancelar.

---

## Reglas de oro del sistema

Estas reglas explican el comportamiento "rígido" del sistema (y sus mensajes de error):

1. **El servidor es la única fuente de verdad del dinero.** Aunque una pantalla muestre un
   monto estimado, al facturar el sistema **recalcula todo**. Los montos nunca dependen de
   lo que envía el navegador.
2. **El historial es evidencia y no se reescribe.** Visitas completadas/canceladas/omitidas
   no se modifican; las lecturas son inmutables; los costos de hace meses no se "recalculan"
   con precios actuales.
3. **El stock nunca puede ser negativo.** Cada entrada/salida valida la existencia
   disponible; el stock se protege con bloqueos mientras se hace el movimiento.
4. **Una lectura se factura a lo sumo una vez.** El sistema lo garantiza aunque se intente
   facturar el mismo periodo dos veces.
5. **Toda operación compuesta es todo-o-nada.** Si algo falla a mitad (p. ej. completar un
   mantenimiento y descontar piezas), no queda nada a medias.
6. **Sin actividad no hay cierre de visita sin motivo.** Para evitar visitas "fantasma",
   cerrar sin actividades exige explicar por qué.
7. **Los CFDI se casan con clientes por RFC exacto.** Un comprobante con RFC desconocido no
   crea clientes: queda pendiente de asignación manual (es señal de datos sucios, no de un
   error del sistema).
8. **Los registros de campo no tocan dinero ni catálogo.** Lo capturado en campo para un
   cliente/impresora fuera del sistema es *evidencia*; el alta real la hace el administrador
   al regularizar (vincular) el registro.

---

## Mapa general de módulos del panel web

| Menú | Qué se gestiona |
|---|---|
| **Dashboard** | Resumen del negocio del día (se adapta a tus permisos) |
| **Inventario** | Impresoras, artículos, mantenimiento, reportes de mantenimiento, almacenes, movimientos |
| **Clientes** | Empresas clientas y su estado de cuenta |
| **Contratos** | Contratos: alta (asistente de 4 pasos), tarifas, impresoras asignadas, facturación por ciclos |
| **Operaciones** | Visitas (calendario), lecturas, registros de campo |
| **Finanzas** | Facturas, CFDI, cuentas por cobrar/pagar, compras, rentabilidad, flujo de caja, cuentas bancarias, conciliación, cierre de periodo |
| **Sistema** | Usuarios, roles y permisos, notificaciones, configuración |
| **Ayuda** | Guía de primeros pasos y glosario integrados |

Los capítulos siguientes explican cada módulo desde la perspectiva del rol que lo usa
a diario.
