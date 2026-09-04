# Ideas — Ubicación del dispositivo para ordenar/filtrar visitas y clientes

> **Estado:** propuesta para discusión / implementación futura.
> **Origen:** sesión 2026-09-04. Analiza el código real (móvil, resources,
> migraciones) antes de redactarse.
> Idea original: "en la versión móvil usemos la ubicación del dispositivo, si
> está disponible, para filtrar o para ordenar los contratos/visitas
> disponibles".

---

## 1. Conclusión ejecutiva

**Vale la pena, pero el 80% del problema no es ordenar: es no tener
coordenadas.** Hoy `clients` solo guarda `direccion_instalacion` (texto,
migración `0001_01_01_000005`); no hay lat/lng de ningún cliente, así que no
existe nada contra qué medir distancia.

La buena noticia: **el sistema ya captura GPS en las lecturas y registros de
campo** (`readings.ubicacion_lat/lng`, `field_records.ubicacion_lat/lng`,
capturado desde el móvil en `CaptureReadingPage.tsx:79` y
`NewFieldRecordPage.tsx:103`). Eso permite **aprender** la ubicación de cada
cliente del GPS de las lecturas tomadas en su sitio — sin geocoding externo,
sin alta manual, sin fricción. El feature se autoalimenta de la operación
normal.

Prioridad sugerida: **baja-media**. Es conveniencia operativa real (ver §4),
no integridad de dinero/stock. El costo principal es el arranque en frío
(§6.1).

---

## 2. El gap de datos y las alternativas para llenarlo

| Fuente de coordenadas | Pros | Contras | Veredicto |
|---|---|---|---|
| **Aprendizaje de lecturas** (GPS ya capturado en sitio) | Cero fricción, cero costo, ya fluye al server, precisa (fue capturada en el escritorio del cliente) | Arranque en frío: hasta que haya lecturas con GPS no hay coords; depende de que el operador otorgue permiso | **Recomendada** |
| **Captura explícita "estoy aquí"** (botón en el detalle de visita) | Confirmación consciente, disponible desde el día 1 | Friction mínima (un tap, opcional) | **Recomendada (complemento)** |
| Geocoding de `direccion_instalacion` (Nominatim/Google/Mapbox) | Llena todo de golpe | Servicio externo + API key + costo + precisión irregular en MX + mantenimiento de dirección textual | Descartada por ahora |
| Alta manual en el panel web | Simple | El admin no sabe las coords; nadie va a teclear lat/lng | Descartada |

**Modelo de datos recomendado:** denormalizar en `clients`:

```
clients.ubicacion_lat  decimal(10,7) nullable
clients.ubicacion_lng  decimal(10,7) nullable
clients.ubicacion_actualizada_en  timestamp nullable
```

Coherente con la "denormalización pragmática" aceptada del proyecto (§3
trade-offs): el listado de visitas lee una columna, no una subconsulta
correlacionada a la última lectura con GPS de cada impresora del contrato.

**Política de actualización** (decisión abierta, ver §7): primera coords se
adoptan siempre; posteriores → opciones: solo si `null` / siempre que difiera
> X metros (el cliente se mudó) / nunca automático. Recomendación inicial:
adoptar la primera, luego actualizar solo con captura explícita (evita que un
GPS raro de una lectura corrompa la ubicación buena).

Dónde vive la lógica de aprendizaje: en el backend, dentro de la transacción
de `ReadingService::captureReading` / `FieldRecordService` (si la lectura trae
GPS y el cliente del contrato no tiene coords → setearlas). Nunca en el
cliente: el móvil no escribe maestros (extensión del espíritu de D15).

---

## 3. Dónde ordenar: en el cliente, no en el server

- Las listas del móvil ya se traen completas con `fetchAll` (VisitsPage trae
  mes corrido + siguiente). El listado de un día son decenas de visitas como
  mucho; ordenar por Haversine **client-side es trivial y suficiente**.
- El server no necesita recibir la posición del operador para ordenar (menos
  superficie de privacidad, menos superficie de API). D1 (el server manda en
  el dinero) no aplica al ordenamiento de una lista local.
- El orden por cercanía es **mejor esfuerzo**: sin coords del cliente o sin
  permiso de GPS → la lista queda como hoy. El chip de cercanía simplemente se
  desactiva o las visitas sin ubicación van al final bajo "Sin ubicación".

Patrón de geolocalización: **one-shot** `getCurrentPosition` con
`maximumAge: 60_000, timeout: 10_000` (idéntico al que ya usa
`CaptureReadingPage`), nunca `watchPosition` (batería). Pedir la posición
**solo cuando el operador activa el modo cercanía** (chip), no al montar la
pantalla: el prompt de permiso no debe ser sorpresivo y la app ya lo pide en
otro momento (captura de lectura).

---

## 4. Casos de uso por pantalla (dónde está el valor real)

1. **"Hoy" (`VisitsPage`, filtro `hoy`)** — ordenar las visitas del día de
   más cerca a más lejos. El operador con 6-8 visitas/día en ciudad con
   tráfico ahorra decisiones de "a cuál voy primero". Es el caso de uso núcleo.
2. **"Vencidas"** — las visitas de recuperación suelen agruparse por zona en
   rondas; orden por cercanía ayuda a armar la ronda del día.
3. **`NewVisitPage` (elección de cliente/contrato)** — al crear visita en
   campo, la búsqueda por nombre ya existe (`filtrados`); ordenar los
   resultados por cercanía ayuda a **desambiguar sucursales del mismo cliente**
   ("Papelería XYZ Centro" vs "Papelería XYZ Norte") y a dar de alta la visita
   del sitio donde estás parado.
4. **`VisitDetailPage` / `PrinterDetailPage`** — mostrar distancia al cliente
   y botón **"Abrir en mapas"** (`https://maps.google.com/?q=lat,lng`). Con
   coords es preciso; hoy ni siquiera hay link de mapa (el `VisitCard` solo
   muestra `cliente_nombre`, sin dirección).
5. **(Bonus, informativo) Evidencia de captura** — el GPS de la lectura ya es
   evidencia anti-fraude. Con la ubicación conocida del cliente se puede
   derivar "lectura capturada a 3 km del sitio" como señal informativa para el
   admin (no bloqueo, no 422). Dejarlo documentado pero fuera de alcance
   inicial: huele a vigilancia y conviene discutirlo con los socios antes.

Qué **NO** es este feature: optimización de ruta (TSP). "Orden por cercanía"
desde la posición actual ≠ ruta mínima entre N paradas. Etiquetar siempre
"cercanía", nunca "ruta óptima" en la UI.

---

## 5. Diseño por fases

### Fase 1 — Datos + display (sin ordenar nada)

- Migración `clients.ubicacion_lat/lng/ubicacion_actualizada_en`.
- Aprendizaje: al capturar lectura (y al regularizar registro de campo) con
  GPS y cliente sin coords → setearlas (dentro de la transacción existente).
- Captura explícita: botón opcional "📍 Guardar ubicación del cliente" en
  `VisitDetailPage` (endpoint `PUT /clients/{id}/ubicacion` con permiso de
  edición de clientes o, mejor, un endpoint acotado habilitado para el socio
  en el contexto de su visita — decisión de permiso abierta, §7).
- `ClientResource`/`VisitResource`: exponer `ubicacion_lat/lng` (`client` ya
  viaja cargado en el detalle; en listas basta con las coords planas junto a
  `cliente_nombre`).
- Móvil: distancia y "Abrir en mapas" en detalle de visita.
- `mobile/src/types/api.ts`: extender `Visit`/`ClientOption` con coords.

### Fase 2 — Orden por cercanía

- Hook `useGeoPosition()` (one-shot, cacheado en memoria 60 s, silencioso si
  no hay permiso).
- Util `distanciaMts(lat1,lng1,lat2,lng2)` (Haversine, ~15 líneas, sin
  dependencias).
- `VisitsPage`: chip "📍 Cercanía" (solo en filtros `hoy`/`vencidas`); al
  activarlo, ordenar cada grupo por distancia; en el `VisitCard` mostrar
  "a 1.2 km". Visitas sin coords del cliente → sección final "Sin ubicación".
- `NewVisitPage`: cuando no hay texto de búsqueda, ofrecer el mismo chip sobre
  `filtrados`.

### Fase 3 — (opcional, discutir antes) Señal de distancia en evidencia

- Al capturar lectura con GPS, si el cliente tiene coords y la distancia >
  umbral (ej. 500 m), anexar la distancia calculada a la respuesta / al
  registro (informativo, para el admin). Requiere conversación previa con los
  socios: es el límite entre evidencia y vigilancia.

---

## 6. Salvedades honestas

1. **Arranque en frío:** hasta que un cliente tenga una lectura con GPS (o
   captura explícita) no aparece en el orden por cercanía. El feature degrada
   elegantemente (lista normal), pero el valor llega gradualmente. Mitigación:
   el botón "Guardar ubicación" permite poblar a conciencia en las primeras
   semanas.
2. **GPS en interiores:** precisión de 10-50 m en oficinas. Para ordenar a
   nivel ciudad es de sobra; para la señal de distancia de Fase 3, usar umbral
   generoso (≥500 m) y nunca bloqueante.
3. **Un cliente = un sitio:** hoy `clients` tiene una sola
   `direccion_instalacion`; coords por cliente es suficiente. Si algún día hay
   clientes multi-sitio, la coords debería mudarse a nivel contrato. No
   resolver ese problema hoy, solo no bloquearlo (por eso el aprendizaje vive
   en el backend, no hardcodeado en el móvil).
4. **Permisos del navegador:** HTTPS ya cubierto (nginx); el permiso ya se
   solicita hoy al capturar lecturas, así que el flujo no es nuevo. Si el
   operador lo niega, el chip queda deshabilitado con copy honesto ("activo
   ubicación en tu navegador para ordenar por cercanía").
5. **Privacidad:** la posición del operador se usa efímeramente en el cliente
   para ordenar y no se persiste ni se envía al server para tal fin. Lo único
   que ya se persiste (GPS de la lectura) es evidencia existente del negocio.
6. **Deuda colindante:** `fetchAll` con tope de 10 páginas (§10 de
   PROJECT.md) — el orden por cercanía hereda ese techo. Con el crecimiento
   real de visitas de un socio el tope está lejos, pero es la misma deuda.

---

## 7. Decisiones abiertas (para la discusión)

1. **Política de refresco de coords del cliente:** ¿solo la primera / siempre
   que difiera > X m / solo manual tras la primera? Recomendación: primera
   automática, luego manual explícita.
2. **Quién puede setear la ubicación explícita:** ¿endpoint de cliente
   (`clientes.editar`, típico admin) o endpoint de contexto de visita
   habilitado para el socio? Recomendación: este último (el que está frente al
   cliente es el socio); requiere pensar el permiso.
3. **¿Distancia en el `VisitCard` permanente o solo con el chip activo?**
   Recomendación: solo con chip activo (menos ruido).
4. **Umbral de Fase 3** (si es que se aprueba) y qué hacer con lecturas
   offline diferidas: el GPS se capturó en sitio pero la distancia se calcula
   al sincronizar — el orden de la transacción no cambia, solo cuándo se
   calcula.
5. **¿Exponer también coords en la web (panel)?** Barato una vez que existen;
   útil para el dashboard de operaciones. Fuera de alcance inicial.

---

## 8. Plantilla de evaluación (§11.6 de PROJECT.md)

- **Tipo:** UX / operativo (móvil)
- **Zona:** corteza móvil + un toque de núcleo (columnas en `clients`,
  aprendizaje dentro de transacciones de lectura)
- **Invariantes tocadas:** ninguna — no toca dinero, stock ni estados; el
  aprendizaje se agrega dentro de transacciones ya existentes
- **Decisiones tocadas:** extiende el espíritu de D15 (el móvil no escribe
  maestros; la coords la aprende/persiste el server). No contradice ninguna.
- **Superficies afectadas:** migración (`clients`), backend
  (ReadingService/FieldRecordService + Resource + endpoint de ubicación),
  móvil (hook geo, util Haversine, VisitsPage/NewVisitPage/VisitDetail)
- **Riesgo si no se hace:** se pierde ahorro de tiempo/ruta del operador y la
  señal de ubicación queda dispersa en lecturas sin explotar
- **Riesgo si se hace mal:** (a) prompt de GPS al abrir la app (mala UX y
  desconfianza); (b) venderlo como "ruta óptima" sin serlo; (c) dejar que un
  GPS defectuoso sobreescriba coords buenas; (d) Fase 3 sin conversación
  previa con los socios (percepción de vigilancia)
- **Verificación:** tests del aprendizaje de coords (lectura con GPS setea
  cliente sin coords; no pisa coords existentes), test de recurso; manual en
  móvil con permiso denegado/concedido
- **Prioridad sugerida:** baja-media — conveniencia real para operadores
  multi-visita; el costo principal es el arranque en frío de coords

---

## 9. Mapa de archivos tocados (referencia rápida)

| Superficie | Archivo |
|---|---|
| Migración | `backend/database/migrations/*_add_ubicacion_to_clients_table.php` (nueva) |
| Aprendizaje | `backend/app/Services/ReadingService.php` (transacción de captura), `backend/app/Services/FieldRecordService.php` |
| Modelo | `backend/app/Models/Client.php` (fillable/casts) |
| Recursos | `backend/app/Http/Resources/ClientResource.php`, `VisitResource.php` (coords planas junto a `cliente_nombre`) |
| Endpoint ubicación explícita | `routes/api.php` + controller (nuevo, permiso a decidir §7.2) |
| Tipos móvil | `mobile/src/types/api.ts` (`Visit`, `ClientOption`) |
| Hook geo | `mobile/src/hooks/useGeoPosition.ts` (nuevo) |
| Util distancia | `mobile/src/lib/geo.ts` (nuevo, Haversine) |
| Listas | `mobile/src/pages/VisitsPage.tsx` (chip cercanía), `mobile/src/pages/NewVisitPage.tsx` |
| Detalle | `mobile/src/pages/VisitDetailPage.tsx` (distancia + abrir en mapas), `mobile/src/components/VisitCard.tsx` (distancia opcional) |
