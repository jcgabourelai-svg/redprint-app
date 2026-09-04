# 02 · Manual del Administrador

**Para quién:** el dueño o administrador del sistema. Es el único rol que ve todo el panel:
clientes, contratos, supervisión de operaciones y configuración de usuarios.

**Permisos:** todos (rol `administrador`). Si tu rol es otro, verás solo las secciones
descritas aquí para las que tengas permiso.

---

## Contenido

1. [Primer inicio](#1-primer-inicio)
2. [Dashboard](#2-dashboard-el-pulso-del-negocio)
3. [Clientes](#3-clientes)
4. [Contratos](#4-contratos-el-corazón-del-sistema)
5. [Operaciones: supervisión de visitas, lecturas y registros de campo](#5-operaciones-supervisión-de-campo)
6. [Sistema: usuarios, roles y notificaciones](#6-sistema-usuarios-roles-y-notificaciones)
7. [Ayuda integrada](#7-ayuda-integrada)
8. [Rutina recomendada del administrador](#8-rutina-recomendada-del-administrador)

---

## 1. Primer inicio

1. Abre la URL del sistema e inicia sesión (ver [README](README.md)).
2. Si es tu primera vez, cambia la contraseña: perfil (menú **Sistema -> Configuración**) o
   el enlace de la pantalla de acceso.
3. Familiarízate con el **Dashboard**; es tu pantalla de control diaria.

> **Importante:** no existe autorregistro. **Tú creas las cuentas** de todos los demás
> usuarios (operadores, técnicos, almacén, contador) desde **Sistema -> Usuarios**.

---

## 2. Dashboard: el pulso del negocio

**Menú: Dashboard** (pantalla inicial tras iniciar sesión).

Todo el contenido se filtra según tus permisos. Contiene:

### KPIs superiores

| Tarjeta | Qué indica |
|---|---|
| **Ingresos del mes** | Facturado en el mes, con % de variación contra el mes anterior |
| **Saldo por cobrar** | Total pendiente de cobro y cuántas facturas lo componen |
| **Páginas impresas del mes** | Volumen impreso por la flota |
| **Flota en renta** | Equipos rentados sobre la flota activa |
| **Valor de inventario** | Valor del stock y cuántos artículos están bajo su umbral |
| **Mantenimientos pendientes** | Órdenes abiertas / equipos en taller |

### Gráficas

- Ingresos de los últimos 6 meses.
- Estado de la flota.
- Flujo de caja (6 meses).
- Rentabilidad Top 5 (con botón **Ver reporte**).

### Tareas y alertas

- **Próximas visitas** (7 días) con acceso directo al calendario.
- **Facturas vencidas** con acceso a facturas.
- **Alertas**: stock bajo (con críticos), compras por vencer/vencidas, mantenimientos
  pendientes y **registros de campo pendientes de regularizar** — cada una con botón al
  módulo correspondiente.

> **Consejo:** el Dashboard es la mejor pista de "qué me falta por atender hoy". Empieza
> siempre tu jornada aquí.

---

## 3. Clientes

**Menú: Clientes**

### Listado

- Columnas: razón social, RFC, contratos activos y **estado de cuenta**:
  - **Al corriente** — sin saldos pendientes.
  - **Pendiente** — tiene facturas con saldo.
  - **Vencido** — tiene facturas pasadas de su fecha de vencimiento.
- Buscador y filtros; al hacer clic en una fila se abre el detalle.

### Dar de alta un cliente

1. **Clientes -> Nuevo cliente**.
2. Completa el formulario con los datos fiscales: razón social y **RFC** (imprescindible:
  los CFDI se casan con clientes por RFC exacto), además de datos de contacto.
3. Guarda.

### Detalle del cliente

- Pestañas con **contratos** y **facturas** del cliente, más KPIs de su cuenta.
- Acciones: **Editar** y **Eliminar**.

> **Importante:** el RFC debe capturarse **exactamente igual** que aparece en los CFDI del
> cliente (mayúsculas, guiones según el SAT). Un RFC distinto hará que sus comprobantes
> queden "sin cliente" en el módulo CFDI y haya que asignarlos a mano.

---

## 4. Contratos: el corazón del sistema

**Menú: Contratos**

### 4.1 Crear un contrato (asistente de 4 pasos)

**Contratos -> Nuevo contrato**. El asistente evita errores en un flujo con consecuencias
(al confirmar, las impresoras pasarán a **RENTADA** y se generará la primera visita):

1. **Datos generales**
   - Cliente, fecha de inicio y fin, **frecuencia de visitas**
     (Mensual / Quincenal / Semanal / Personalizada) y **días de gracia de lectura**
     (días tras el fin del ciclo en que una lectura tardía aún cierra el ciclo).
2. **Impresoras**
   - Selecciona los equipos a asignar. Puedes hacerlo ahora (equipos con serie conocida)
     o dejarlo como **plan de modelos** para que el operador instale las series reales
     en campo (ver instalación en el [capítulo del operador](03-operador-campo.md)).
3. **Configurar tarifa**
   - Esquemas predefinidos: **Renta fija** o **Puro consumo**, o modo manual con
     **tarifa base + páginas incluidas + costo por página excedente**. También la
     lectura mínima.
4. **Confirmación**
   - Revisa el resumen (incluye la advertencia de efectos) y confirma.

Al terminar: contrato **CTR-NNNN en ACTIVO**, impresoras asignadas pasan a **RENTADA** y el
sistema crea la **primera visita** automáticamente.

> **Nota sobre los ciclos:** el periodo de cobro corre por el **aniversario de la fecha de
> inicio** (inicio 20-ago → ciclos del 20 al 19). La primera visita de lectura se programa
> **un periodo después del inicio**, nunca el mismo día del alta, para evitar la "lectura
> cero" del día de instalación.

### 4.2 Lista de contratos

- Estados: **ACTIVO / SUSPENDIDO / FINALIZADO / CANCELADO**.
- Etiquetas de esquema de tarifa: *Renta fija*, *Puro consumo*, *Tarifa base + excedentes*.
- Filtros y búsqueda; clic en fila → detalle.

### 4.3 Detalle del contrato

Desde aquí se administra toda la vida del contrato:

**Gestión de impresoras**

- **Asignar impresora**: modal que exige la **lectura inicial** (contador físico al
  instalar; es la base de cálculo del primer periodo) y un alias/ubicación opcional
  (ej. "Recepción").
- **Liberar impresora**: retiro con **motivo obligatorio**; el equipo vuelve a un almacén.

**Comercial**

- Editar plan/tarifa, **Suspender**, **Finalizar** o **Cancelar**.
- Finalizar/Cancelar cancelan las visitas futuras pendientes y liberan las impresoras
  activas al almacén.

**Facturación del contrato**

- Vista de **ciclos facturables**: periodos facturados vs. pendientes (clave `AAAA-MM-DD`
  = fecha de inicio del ciclo).
- **Generación de facturas en borrador por lote**: un borrador por ciclo (nunca fusiona
  ciclos, para conservar la tarifa de cada uno).
- Pestañas de lecturas, ciclos y facturas del contrato.

> **Sin lectura de corte en un ciclo:** ese ciclo se cobra solo con la **tarifa base** y su
> paquete de páginas se **acumula**: el siguiente ciclo con lectura compara el consumo de
> todo el hueco contra el paquete acumulado. Traducción: no se pierde consumo, pero se
> recomienda que las lecturas de cierre lleguen en la ventana (fin de ciclo −5 días … fin +
> días de gracia).

Detalle completo de facturación y cobranza en el [capítulo de finanzas](06-finanzas.md).

---

## 5. Operaciones: supervisión de campo

El día a día de campo lo ejecutan los operadores desde la app móvil (ver
[capítulo 3](03-operador-campo.md)). Desde el panel web el administrador **supervisa,
corrige y regulariza**.

### 5.1 Visitas (calendario)

**Menú: Operaciones -> Visitas**

- Dos vistas conmutables: **Calendario** y **Lista**.
- **Filtros**: estado (Pendiente/Completada/Reprogramada/Cancelada/Omitida), tipo
  (Lectura/Mantenimiento/Instalación/Retiro/Entrega de insumos) y **socio**.
- **Nueva visita** (modal): para casos manuales/puntuales.
- **Generación masiva de visitas**: crea visitas por rango de fechas y contratos. Úsala con
  cuidado: el sistema **genera automáticamente** las visitas de los contratos cada madrugada
  (un mes hacia adelante); la generación manual es para reposiciones o arranques.

**Detalle de una visita:** datos, estado, tipo, lecturas capturadas (con enlace), y acciones
**Completar / Reprogramar / Editar / Eliminar** (solo en estados abiertos; las visitas
cerradas son inmutables).

> **Omitida vs. Cancelada (importante):** *Omitida* = "se descarta este espacio" y el
> calendario **no lo vuelve a generar**. *Cancelada* = cancelación contractual y **sí puede
> regenerarse** si el contrato se reactiva. No las uses indistintamente.

### 5.2 Lecturas

**Menú: Operaciones -> Lecturas**

- Listado con filtros por **socio capturista** y **rango de fechas**; orden por fecha.
- **Detalle**: foto del contador, impresora, contrato, capturista; las lecturas anómalas
  muestran su justificación.
- Si necesitas capturar una lectura desde la oficina, entra al detalle de la visita y usa
  la captura web (mismas reglas que la app: anomalía ⇒ justificación).

### 5.3 Registros de campo (bandeja de regularización)

**Menú: Operaciones -> Registros de campo**

Aquí llegan las capturas del móvil de **clientes o impresoras que no existen en el sistema**
(p. ej. "Tacos El Güero", impresora HP de un lugar sin contrato). Es el puente entre la
evidencia de campo y los datos reales, y **solo se regulariza desde la web**.

La bandeja muestra:

- Filtro por estado (por defecto **PENDIENTE**), tipo (Contador / Entrega de insumos /
  Otro) y socio; KPI de pendientes.

Para cada registro puedes:

- **Ver detalle**: foto, GPS, datos crudos (nombre del lugar, dirección, marca/modelo/serie
  en texto libre, contador, insumos, notas, fecha/hora de captura).
- **Vincular** (regularizar): conecta el registro con cliente/contrato/impresora reales.
  En una sola operación el sistema:
  - reutiliza (o crea) la visita correspondiente y registra la lectura con el contador
    capturado;
  - instala la impresora con `lectura inicial = contador capturado` (línea base; no se
    cobra histórico previo);
  - descuenta del stock los insumos entregados (nace el movimiento de kardex aquí).
- **Descartar**: cuando la captura no procede.

> **Importante:** los registros **VINCULADOS y DESCARTADOS son inmutables**: ya no se pueden
> editar. Lee bien antes de resolver. La salida de stock solo nace al vincular, nunca al
> capturar en campo.

---

## 6. Sistema: usuarios, roles y notificaciones

### 6.1 Usuarios y roles

**Menú: Sistema -> Usuarios** (dos pestañas)

**Pestaña Usuarios**

- Crear usuario (nombre, correo, contraseña inicial, rol), editar, activar/desactivar.
- **Restablecer contraseña** para un usuario que la olvidó (no hay autorrecuperación).

**Pestaña Roles**

- Crear roles de trabajo a medida (p. ej. *Técnico*, *Almacenista*, *Contador*).
- Editor con el **catálogo de permisos por módulo** (23 permisos en 6 módulos):
  marca/desmarca permisos y guarda.

| Módulo | Permisos |
|---|---|
| Inventario | Impresoras, Artículos, Mantenimiento, Almacenes, Movimientos |
| Clientes | Clientes |
| Contratos | Contratos |
| Operaciones | Calendario, Lecturas, Registros de campo |
| Finanzas | Facturas, CFDI, Ctas. por cobrar, Ctas. por pagar, Compras, Rentabilidad, Flujo de caja, Ctas. bancarias, Conciliación, Cierre |
| Sistema | Usuarios, Notificaciones, Configuración |

> **Consejo:** da el mínimo permiso necesario por rol. Ejemplo: un almacenista solo necesita
> los 5 permisos de Inventario (de hecho, el rol `operador-inventario` ya viene así de
> ejemplo).

### 6.2 Notificaciones

**Menú: Sistema -> Notificaciones**

- Bandeja con filtros por tipo (alerta / aviso / recordatorio / info / éxito), estado y
  categoría; **marcar leída** / **marcar todas**; modal de detalle.
- El sistema notifica eventos críticos, p. ej. una orden de mantenimiento con
  **severidad CRÍTICA** avisa a todos los usuarios con permiso de mantenimiento.

### 6.3 Configuración

**Menú: Sistema -> Configuración**

- **Perfil**: tus datos y rol (solo lectura).
- **Cambiar contraseña**.
- **Preferencias de visualización**: tema claro/oscuro/sistema, formato de fecha.
- **Notificaciones** e **información del sistema**.

> **Limitación conocida:** en la versión actual esta pantalla guarda preferencias solo en
> el navegador; el cambio de contraseña real se hace desde su botón (apunta al flujo con
> contraseña actual) o pidiéndolo a otro administrador.

---

## 7. Ayuda integrada

**Menú: Ayuda** — guía paso a paso filtrada por permisos, con botón **Ir** por cada tema:

- *Empezando*: almacén → artículos → impresoras → clientes → contrato.
- *Operación diaria*: visitas → lecturas → mantenimiento.
- *Finanzas*: facturas → CxC → compras → CxP → bancos → conciliación → cierre →
  rentabilidad → flujo de caja.
- *Administración*: usuarios y roles. Más un glosario integrado.

---

## 8. Rutina recomendada del administrador

**Diaria**

1. Revisar el **Dashboard** (alertas: stock bajo, registros de campo pendientes,
   mantenimientos pendientes).
2. Supervisar las visitas de hoy en **Operaciones -> Visitas**.
3. Regularizar **registros de campo** pendientes.

**Semanal**

4. Revisar **facturas vencidas** y dar seguimiento de cobranza.
5. Revisar órdenes de **mantenimiento** estancadas y compras por recibir.

**Mensual (cierre)**

6. Verificar lecturas de corte de los ciclos que cierran.
7. Generar facturas (por lote de borradores desde cada contrato o el asistente general).
8. Registrar pagos y conciliar el banco.
9. **Cerrar el periodo** (flujo completo en el [capítulo de finanzas](06-finanzas.md)).
