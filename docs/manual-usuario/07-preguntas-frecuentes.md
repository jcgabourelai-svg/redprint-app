# 07 · Preguntas frecuentes y errores comunes

Guía rápida de solución de problemas para todos los roles.

---

## Acceso y sesión

**No puedo iniciar sesión / "Credenciales incorrectas"**
Verifica tu correo y contraseña. La contraseña lleva mínimo 8 caracteres, una mayúscula y
un número. Si continúa, pide al administrador que te la reestablezca desde
**Sistema -> Usuarios** (no hay autorrecuperación por correo).

**Olvidé mi contraseña**
Un administrador debe reestablecerla desde **Sistema -> Usuarios -> Restablecer
contraseña**. Después cámbiala desde tu perfil.

**La app móvil dice que mi sesión expiró (401)**
Inicia sesión de nuevo. Si accedes desde el teléfono por la red local (IP en vez de
nombre), la URL y el puerto deben ser exactamente los que el administrador configuró;
si la app responde 419/401 al enviar formularios, avísale: la cookie de sesión está
ligada al dominio configurado.

**No veo una sección del menú que otros sí ven**
El menú se filtra por permisos de tu rol. Pide al administrador que revise tu rol en
**Sistema -> Usuarios -> Roles**.

---

## Mensajes del sistema (422 y similares)

**"La lectura requiere justificación" / "La lectura es anómala"**
El contador que capturaste es menor que la última lectura (o da un salto atípico). Captura
el valor real del contador físico y escribe la **justificación** (mín. 5 caracteres). El
servidor valida contra su propia última lectura, que puede ser más reciente que la que ve
tu pantalla: si te lo vuelve a pedir, vuelve a justificar y reintenta.

**"La visita ya no puede modificarse" / error al capturar en una visita**
Solo las visitas **Pendiente/Reprogramada** admiten capturas y cierre; las
Completadas/Canceladas/Omitidas son inmutables. Verifica el estado en el detalle.

**"No se puede capturar/completar: la visita está a más de 5 días en el futuro"**
Regla de protección del ciclo de cobro. Espera a que falten 5 días o menos para la fecha
programada (o pide reprogramar la visita a una fecha cercana).

**"No hay stock suficiente" en una entrega o pieza**
El stock real está más bajo de lo que intentas sacar. Revisa el artículo en
**Inventario -> Artículos** y su kardex en **Inventario -> Movimientos** para ver qué
consumió el stock.

**"Este registro ya está resuelto" en registros de campo**
Los registros VINCULADOS y DESCARTADOS son inmutables. Si algo quedó mal vinculado,
consultan al administrador: la corrección se hace en las entidades resultantes, no
editando el registro.

**Error 403 al pulsar un botón**
Tu rol no tiene el permiso para esa acción (aunque veas la pantalla). Reporta qué botón
era para que revisen tus permisos.

---

## Operación de campo

**¿Qué pasa si no hay internet en el cliente?**
Puedes capturar **lecturas de contador** y **registros de campo**: quedan en la cola del
teléfono (indicador ⟳) y se sincronizan solas al volver la señal. Entregas, instalación,
retiro, reporte de fallas y nueva visita sí requieren conexión.

**Capturé una lectura y aparece "⟳ Pendiente de sincronizar"**
Normal si estabas sin conexión. Al recuperar red, la app sincroniza sola; también puedes
forzarla con el botón del indicador ⟳. Si aparece ⚠ Error, ábrelo: tendrás **Reintentar**
o **Descartar** (un error típico es la anomalía sin justificación: reintenta con la
justificación).

**El cliente al que llegué no está en el sistema**
Usa **Registro de campo** (📋 Registro) desde la pantalla de visitas y captura la evidencia;
un administrador la vinculará a datos reales desde **Operaciones -> Registros de campo**.

**Retiré una impresora y sigue "asignada"**
Si la retiraste por **sustitución por falla** con la casilla *"Crear orden correctiva"*, el
equipo queda **En mantenimiento** (taller) de forma intencional hasta completar la orden;
completa la orden para que retome su estado.

**¿Por qué no se cerró mi visita aunque capturé todo?**
El cierre siempre es explícito: botón **Completar visita**. Está diseñado así para que
puedas seguir agregando actividades (p. ej. una entrega) antes de irte.

**¿Qué diferencia hay entre Omitida y Cancelada?**
**Omitida** = descartaste ese espacio a mano y el calendario **no lo vuelve a generar**.
**Cancelada** = cancelación contractual; el calendario **puede regenerarla** si el contrato
se reactiva.

---

## Inventario y mantenimiento

**Quiero sacar de circulación una impresora**
La operación normal es la **baja** (desactivar con razón), que conserva la historia. La
eliminación física solo procede si el equipo no tiene lecturas, órdenes, gastos ni
contratos.

**El costo de una pieza en una orden cambió de precio**
No es un error: los costos se **congelan** al momento del hecho (evidencia histórica). El
precio nuevo aplica a movimientos nuevos.

**¿Puedo completar una orden sin piezas?**
Sí: el costo total será solo la mano de obra. Las piezas son opcionales.

---

## Finanzas

**La vista previa de la factura muestra advertencias**
Léelas: avisan de lecturas sin contrato, contratos sin lecturas o periodos solapados.
Resuélvelas antes de emitir; el servidor además recalcula y bloquea doble cobro del mismo
periodo.

**Un CFDI quedó "sin cliente"**
El RFC del comprobante no coincide exactamente con ningún cliente. Revisa el RFC del
cliente (mayúsculas/guiones) o asigna el cliente manualmente desde el módulo CFDI. El
sistema no crea clientes desde CFDI.

**Importé dos veces el mismo XML**
No pasa nada: la importación es idempotente por UUID; el duplicado queda marcado como tal.

**No puedo cerrar el periodo**
Revisa el panel de validaciones: rentabilidad negativa **bloquea**; facturas/conciliación
pendientes se reportan. Corrige e intenta de nuevo. Recuerda que el cierre es
**irreversible** y no congela la escritura de periodos pasados.

**¿La factura por lecturas puede incluir una lectura con fecha anterior al periodo?**
Sí y es intencional: la lectura mide el hueco acumulado desde la última facturada; el
periodo facturado sigue siendo el ciclo.

---

## Limitaciones conocidas de la versión actual

Para evitar confusiones, esto es lo que hoy está **en prototipo** o con comportamiento
limitado (el administrador del sistema puede confirmar el estado):

- La **campana de notificaciones** del encabezado del panel web muestra contenido de
  demostración (el módulo real está en **Sistema -> Notificaciones**).
- **Configuración** (preferencias) se guarda solo en el navegador local.
- Algunos **selects** de finanzas (proveedores/artículos en compras, cuentas/periodos en
  conciliación) y algunas gráficas de reportes usan datos de ejemplo: verifica contra los
  módulos fuente.
- Hay botones visibles sin función todavía (Imprimir de visita, Ver todas las
  notificaciones, entre otros).
- El **timbrado CFDI no se hace aquí**: RedPrint importa XML ya timbrados.
- La **conciliación bancaria es manual** (sin importación de estado de cuenta).
- No hay **portal de cliente** ni autorregistro de usuarios.
- La app móvil es una **web app** (no nativa) y sin conexión solo funcionan las capturas
  de lecturas y registros de campo, no la navegación completa.

Si algo de esta lista te afecta en tu operación diaria, coméntalo con el administrador
del sistema.
