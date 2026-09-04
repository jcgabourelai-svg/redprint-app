# 03 · Manual del Operador de campo

**Para quién:** el "socio" u operador que visita a los clientes: lee contadores, entrega
insumos, reporta fallas, instala y retira impresoras.

**Dónde:** app móvil **"RedPrint Operativo"**, en la misma dirección del sistema seguida de
`/m/` (en local: `http://localhost:8080/m/`). Se usa en el navegador del teléfono; pide al
administrador la URL y tus credenciales.

**Permisos que usan tus botones:** visitas (`operaciones.calendario`), lecturas
(`operaciones.lecturas`), registros de campo (`operaciones.registros-campo`), entregas de
insumos (`inventario.articulos`), reporte de fallas y órdenes (`inventario.mantenimiento`),
instalación (`contratos` + `inventario.impresoras`), retiro (`contratos` +
`inventario.almacenes`). Si no ves un botón, probablemente no tienes el permiso.

---

## Contenido

1. [Iniciar sesión](#1-iniciar-sesión)
2. [Pantalla principal: Hoy / Calendario](#2-pantalla-principal-hoy--calendario)
3. [La visita paso a paso](#3-la-visita-paso-a-paso)
4. [Tomar lectura de contador](#4-tomar-lectura-de-contador)
5. [Entregar insumos](#5-entregar-insumos)
6. [Reportar una falla](#6-reportar-una-falla)
7. [Instalar una impresora](#7-instalar-una-impresora)
8. [Retirar una impresora](#8-retirar-una-impresora)
9. [Completar, reprogramar u omitir la visita](#9-completar-reprogramar-u-omitir-la-visita)
10. [Crear una visita manualmente](#10-crear-una-visita-manualmente)
11. [Registro de campo: el cliente no está en el sistema](#11-registro-de-campo-el-cliente-no-está-en-el-sistema)
12. [Trabajo sin conexión (cola offline)](#12-trabajo-sin-conexión-cola-offline)
13. [Alertas y perfil](#13-alertas-y-perfil)
14. [Reglas de oro del operador](#14-reglas-de-oro-del-operador)

---

## 1. Iniciar sesión

1. Abre la URL de la app móvil en el teléfono.
2. Escribe tu correo y contraseña y pulsa **Iniciar sesión**.

Si tu sesión vence, la app te regresa al login. Si vas a probar desde el teléfono conectado
a la red de la empresa, la URL debe incluir el puerto correcto (pídesela al administrador).

## 2. Pantalla principal: Hoy / Calendario

Es tu pantalla de arranque (pestaña **Hoy**). Muestra tus visitas **agrupadas por día** con:

- **Filtros rápidos**: `Hoy` · `7 días` · `Mes` · `Vencidas`, y sub-filtro `Activas / Todas`.
- En **Mes** puedes navegar entre meses con `‹` `›`.
- Sección roja **⚠ Vencidas (n)**: visitas atrasadas (pendientes con fecha pasada).
- Botones: **+ Visita** (crear visita manual), **📋 Registro** (registro de campo) y
  campanita 🔔 de notificaciones.

Toca una tarjeta de visita para abrir su **detalle**: datos del cliente (teléfono, correo,
dirección con enlace a mapas), notas, impresoras del contrato con su progreso de captura
`(capturadas/total)`, actividades registradas y botones de acción.

> **Lectura del progreso:** cada impresora muestra ✓ Capturada (+ páginas), ⟳ Pendiente de
> sincronizar, ⚠ Error de sincronización, o "Ver acciones" si aún no tiene lectura.

## 3. La visita paso a paso

Una visita abierta (Pendiente o Reprogramada) es tu centro de trabajo. Flujo típico de una
**visita de lectura**:

1. Entra al detalle de la visita.
2. Toca cada **impresora** del contrato → **Tomar lectura** (una por una).
   El indicador ✓ te dice cuáles llevas.
3. Si entregas tóner: **Entregar insumos** (acción de la visita).
4. Si el equipo falla: **Reportar falla**; si vas a cambiar el equipo: retira e instala.
5. Cuando termines todo: **Completar visita**.

**Recuerda:**

- El **tipo de visita es solo el motivo**, no una restricción: en cualquier visita abierta
  puedes hacer cualquier actividad (leer, entregar, reportar, instalar/retirar).
- **La visita no se cierra sola**: aunque captures todas las lecturas, debes pulsar
  **Completar visita**. Eso es a propósito: te permite seguir agregando actividades (p. ej.
  una entrega de tóner) antes de cerrar.
- Solo puedes capturar/cerrar visitas abiertas y cuya fecha no esté a más de **5 días en el
  futuro** (si adelantas más, el servidor lo rechaza).

## 4. Tomar lectura de contador

Desde la impresora (o su detalle) → **📊 Tomar lectura**.

1. Escribe el **contador actual** tal cual aparece en el display de la impresora.
   La pantalla te muestra en vivo las **páginas del periodo** (diferencia contra la última
   lectura) — el monto en dinero se calcula al guardar.
2. **Toma foto del contador** (recomendado: es tu evidencia).
3. Guarda con **Guardar lectura**.

**Anomalías (muy importante):**

- Si el contador es **menor que la última lectura** (retrocedió) o el salto es **atípico**,
  la app te avisa y te **exige una justificación** (mínimo 5 caracteres; ej. *"se cambió la
  placa y el contador se reinició"*). El servidor valida de nuevo con los datos reales: si
  la rechaza, la app te vuelve a pedir la justificación; escríbela y reintenta.
- La ubicación GPS se captura automáticamente y en silencio al abrir la formulario; no
  necesitas hacer nada.

**Sin conexión:** el botón dirá *"Guardar (se sincronizará después)"* y la lectura queda en
cola local (ver [sección 12](#12-trabajo-sin-conexión-cola-offline)). Al sincronizar verás
el resultado con **páginas del periodo y consumo estimado en dinero**.

Cada impresora admite **una lectura por visita**; si ya está capturada, en cola o con error,
la app bloquea la captura duplicada.

## 5. Entregar insumos

Desde el detalle de la visita → **📦 Entregar insumos** (requiere conexión).

1. Busca el artículo por nombre, marca o SKU (los consumibles sin stock aparecen en rojo y
   no se pueden seleccionar).
2. Captura la **cantidad** (entre 1 y el stock disponible).
3. **Confirmar entrega**. Puedes encadenar varias entregas: la lista *"Ya entregado en esta
   visita"* se actualiza con cantidades y subtotales.

La salida de stock se registra en el momento (por eso requiere conexión). El costo se
congela al valor del día: es evidencia histórica.

## 6. Reportar una falla

Desde el detalle de la impresora → **⚠️ Reportar falla** (requiere conexión).

1. Verifica la impresora (puedes cambiarla si hay varias).
2. Elige el **tipo de problema**: No imprime · Calidad deficiente · Atascos · Error en
   pantalla · Otro.
3. Elige la **severidad**: Baja · Media · Alta · **Crítica** (una falla crítica notifica de
   inmediato a los usuarios de mantenimiento).
4. Describe el problema (obligatorio, mín. 5 caracteres) y adjunta **foto opcional**.
5. **Reportar falla**.

Resultado: se crea una **orden correctiva** vinculada a la visita y la impresora pasa a
**EN MANTENIMIENTO** (taller) hasta que alguien complete la orden. Reportar la falla **no
cierra tu visita**. Si tú mismo reparas el equipo en el momento, puedes usar **Completar
orden** desde la app (ver [capítulo del técnico](04-tecnico-mantenimiento.md)).

## 7. Instalar una impresora

Desde el detalle de la visita → **📥 Instalar impresora** (requiere conexión).

1. Si el contrato tiene puestos liberados sin reemplazo, elige el modo:
   - **🔁 Sustituye a un equipo retirado** (hereda alias y color; la app puede detectarlo
     solo si en esta misma visita retiraste un equipo por falla), o
   - **➕ Equipo adicional**.
2. Selecciona la impresora: solo aparecen equipos **En almacén**; las que corresponden al
   plan del contrato se muestran primero con la etiqueta **EN PLAN**.
3. Captura la **lectura inicial** (viene precargada con el contador físico reportado de la
   serie) y, si quieres, un **alias/ubicación** (ej. "Recepción", máx. 60 caracteres).
4. **Confirmar instalación**.

La lectura inicial es la **línea base** del cobro: las páginas del primer periodo se miden
desde ahí.

## 8. Retirar una impresora

Desde el detalle de la impresora → **📤 Retirar impresora** (requiere conexión).

1. Selecciona la impresora (si no vino preseleccionada).
2. **Motivo del retiro**: Sustitución por falla · Rotación de flota · Fin de contrato ·
   Cancelación de contrato · Otro.
3. Captura el **contador al retirar** (la app te muestra las páginas pendientes de facturar
   desde la última lectura; si el contador final es menor que la última lectura, la tarjeta
   se pinta roja: revisa la captura).
4. Si **no se puede leer el contador**, marca la casilla y escribe la **justificación
   obligatoria** (ese tramo sin leer no se factura).
5. Si el motivo es **Sustitución por falla** y tienes permiso de mantenimiento, puedes
   dejar activada la casilla **"Crear orden correctiva"** (viene activada) con la
   **descripción del problema** obligatoria: el sistema crea la orden en el mismo acto y la
   impresora queda en taller.
6. Elige el **almacén destino** y confirma con **Confirmar retiro**.

## 9. Completar, reprogramar u omitir la visita

En el detalle de la visita:

- **Completar visita**: abre un modal con el resumen de actividades (lecturas, entregas,
  mantenimientos, cambios de impresora).
  - Con actividades: el motivo de cierre es opcional.
  - **Sin actividades**: el motivo de cierre es **obligatorio** (ej. *"cliente cerrado,
    no atendieron"*).
  - Una vez completada, la visita ya no puede modificarse.
- **Reprogramar**: cambia la fecha de la visita.
- **Omitir visita**: descarta ese espacio del calendario. **Úsala con cuidado**: una visita
  omitida **no vuelve a generarse** para ese periodo (a diferencia de una cancelación por
  contrato). Pide confirmación antes de usarla si tienes dudas.

## 10. Crear una visita manualmente

**Visitas -> + Visita** (requiere conexión).

1. Busca el cliente (solo clientes con contrato activo; puedes buscar por razón social o
   número de contrato).
2. Si el cliente tiene varios contratos, elige uno.
3. Elige el **tipo de visita** (Lectura de contador · Instalación · Retiro · Entrega de
   insumos · Mantenimiento) y la **fecha** (por defecto hoy).
4. Notas opcionales → **Crear visita**. La visita queda asignada a ti.

Si el cliente no aparece en el buscador, usa el enlace **"¿El cliente no está en sistema?"**
y captura un registro de campo (siguiente sección).

## 11. Registro de campo: el cliente no está en el sistema

Para visitas a lugares **fuera del catálogo** (sin cliente/contrato/impresora en el
sistema). Es tu plan B: capturas la **evidencia cruda** y el administrador la vincula a
datos reales después.

**Visitas -> 📋 Registro**. Captura:

- **Tipo de registro**: Contador · Entrega de insumos · Otro.
- **Nombre del lugar/cliente*** (texto libre) y dirección opcional.
- Impresora reportada (marca, modelo, No. de serie, texto libre).
- Si es Contador: el **valor del contador**. Si es Entrega: filas de artículos
  (descripción libre + cantidad).
- Notas, **foto de evidencia** y **📍 ubicación manual** (botón para capturar GPS cuando
  quieras, a diferencia de las lecturas que lo toman solas).

**Funciona 100 % offline**: siempre pasa por la cola de sincronización (con red sale al
instante; sin red queda encolado). Al guardar, la app te explica que un administrador lo
regularizará en **Operaciones -> Registros de campo** del panel web.

> **No captures aquí clientes que sí existen**: usa la visita normal. El registro de campo
> no genera cobros ni salidas de stock por sí mismo (eso nace al regularizar).

## 12. Trabajo sin conexión (cola offline)

**Qué funciona sin internet:** solo dos capturas — **lecturas de contador** y **registros
de campo**. Son las operaciones críticas y más frecuentes. Todo lo demás (entregas,
instalación/retiro, reporte de fallas, nueva visita, completar orden) **requiere conexión**
y muestra un aviso 📴.

**Cómo funciona la cola:**

- Lo capturado sin conexión se guarda en el teléfono (IndexedDB) y se sincroniza
  **FIFO** automáticamente: al abrir la app, al volver la señal o con el botón del
  indicador flotante **⟳**.
- El indicador abre un **panel de la cola**: pendientes, errores, **reintentar** y
  **descartar**.
- Clasificación de errores: si es de **red**, el item se queda y reintenta solo; si el
  **servidor lo rechaza** (p. ej. falta justificar una anomalía), queda marcado en *error*
  permanente hasta que lo resuelvas o lo descartes.
- Antes de cerrar sesión, revisa tu **Perfil -> tarjeta Sincronización**: si dice que hay
  pendientes, sincroniza primero (acércate a una zona con señal y pulsa ⟳).

**Reglas de la cola de lecturas:**

- No puedes capturar dos veces la misma impresora en la misma visita (ni en cola, ni ya
  sincronizada, ni con error): la app lo bloquea.
- Si un envío quedó "a medias" (timeout), el reintento de **registros de campo** no duplica
  (está protegido contra duplicados en el servidor).

## 13. Alertas y perfil

- **Alertas (🔔)**: bandeja de notificaciones; tocar una no leída la marca como leída;
  botón **Marcar todas como leídas**.
- **Perfil**: tu nombre, correo, rol, **permisos** (botón para verlos) y la **tarjeta de
  sincronización** con el conteo de pendientes. Cierra sesión con **Cerrar Sesión**.

## 14. Reglas de oro del operador

1. **Fotografía siempre el contador.** Es la evidencia que respalda el cobro.
2. **Nunca "inventes" un número**: si el contador retrocede, capta el valor real y
   justifica la anomalía. Si no puedes leerlo (equipo muerto), en el retiro usa la casilla
   *"No se puede leer el contador"* con su justificación.
3. **Cierra la visita tú mismo** (botón Completar visita) al irte del cliente; sin
   actividades, explica el motivo.
4. **No te adelantes más de 5 días** a capturar o cerrar una visita futura: el sistema lo
   rechaza para proteger el ciclo de cobro.
5. **Omitir es definitive**: omite un espacio de visita solo cuando estés seguro.
6. **Cliente fuera de sistema → registro de campo**, no improvises con otro cliente.
7. Antes de cerrar sesión o entregar el teléfono, verifica que la **cola ⟳ esté vacía**.
