# Proposal: core-eventos

> Reemplaza a `puestos-por-evento`. Su exploración sigue valiendo para quirks y servicios, pero "puesto" pasa a llamarse **cargo** y `participantes.activo` (el "Marcarme disponible" que cada uno activaba por su cuenta) desaparece. No hay migración: la DB solo tiene datos de prueba.
>
> **Revisión 5 (rediseño de la lista de invitados y permisos, 2026-10-15) manda sobre todo lo que toque:** roles fijos administrador / jefe_mesero / trabajador (id `mesero`); portero, mesero, etc. son cargos; permiso por cargo "maneja la lista de invitados"; el .xlsx se lee en el navegador y cada invitado es un registro con marca de asistencia. Ver "Revisión 5" al final.
>
> **Revisión 4 (auditoría, 2026-10-15):** Q10 resuelta (los cargos del catálogo sin titular aparecen con sus tareas "sin responsable" como vista derivada y se reasignan solo dentro del evento); no existen cargos propios del evento (ex Q15, descartada por el usuario) ni "activar cargos"; Q9 resuelta (cada `Apoyo` con su copia); `ocupacion/{ccid}` guarda el `cid` del snapshot; `actividad` se escribe en todo marcado; el marcado del mesero queda acoplado a su auditoría por reglas. Detalle y tabla de viabilidad de reglas en `design.md`.
>
> **La Revisión 3 (al final) reemplaza lo que contradiga en Revisión 2 y en el cuerpo**: ya no se copia el catálogo entero al evento; el evento guarda un snapshot de cada cargo al asignarlo a una persona. Desmontaje, montaje e inventario salen del núcleo.

## Revisión 2 (2026-10-14)

Qué cambió y por qué (decisiones del usuario, autoritativas; los puntos marcados **[reemplazado por Rev. 3]** ya no rigen):

1. **Dos niveles: GENERAL y POR EVENTO.** Menú de admin y jefe: **Eventos · Equipo · Cargos** (el admin suma **Configuración**, ver punto 8). Menú del mesero: **Eventos** (solo los suyos). "Asignar" sale del menú (la asignación vive dentro del evento) y el viejo ítem "Tareas" (tareas de un evento) pasa a ser **Cargos**.
2. **"Equipo" del menú = lista GLOBAL de usuarios** (solo el admin promueve mesero↔jefe y activa/inactiva). Se descarta el rename a "Usuarios" que proponía el design (D13): la ruta sigue siendo `/app/admin/equipo`. El equipo de un evento es una sección **dentro** del evento ("Equipo del evento").
3. **Nueva capacidad `catalogo-cargos`.** "Cargos" del menú es un **catálogo global** (admin y jefe): cargos (`Mesero N` autonumerado, `Portero`, nombre libre, ~~`Desmontaje`~~ **[Desmontaje pospuesto, Rev. 3; se suma `Apoyo`]**) y, por cada cargo, sus tareas. No está atado a ningún evento. El mesero no lo ve.
4. **Detalle del evento (botón "Ingresar").** Secciones: Equipo del evento, Cargos del evento, Asignación, Tareas, ~~Desmontaje/Inventario~~ **[pospuesto, Rev. 3]**, Invitados y Auditoría.
5. ~~**Catálogo → evento = copia snapshot.** El admin o el jefe dispara "Copiar cargos del catálogo"...~~ **[reemplazado por Rev. 3: el catálogo es plantilla; el snapshot se hace por cargo al asignarlo a una persona, no se copia el catálogo entero]**. Se mantiene que, tras el snapshot, el evento es **independiente** del catálogo (editar el catálogo nunca cambia eventos existentes ni pasados) y que cada asignación y edición por evento se audita.
6. **Borrar eventos: solo el admin.** El jefe crea y edita pero no borra. (Rev. 3 agrega: solo se borra si no es un evento pasado con datos; si no, se archiva.)
7. **Ya hecho en código** (se marca como hecho y no se replanifica): modelo de 3 roles con alta directa como mesero, flujo "pendiente" eliminado y reglas de `usuarios` desplegadas; providers de Firebase y script que genera la apiKey; `SegmentedControl` compartido en Equipo (orden admin → jefe → mesero, update optimista); pantalla Eventos con editar (admin y jefe), borrar (solo admin, modal de confirmación, cascada), botón "Ingresar" placeholder y sin "Marcarme disponible"; menú sin "Asignar".
8. **Nueva capacidad `configuracion-meseros` (solo admin).** Cada evento tiene `personas` (cantidad de invitados, opcional en eventos viejos; el campo ya se está agregando al formulario y a la card en código). En la pantalla **Configuración** (solo admin) se definen intervalos de personas → cantidad de meseros (editables y borrables, sin superposiciones, el último puede ser abierto "o más") o el modo **libre** (sin sugerencia). La cantidad **sugiere** cuántos cargos `Mesero N` activar en el evento (Rev. 3: ya no es "al copiar el catálogo"); el admin o el jefe pueden cambiarla para ese evento. Menú del admin: Eventos · Equipo · Cargos · Configuración.
9. **Git: Milan-App SÍ es un repo** (rama `feat/milan-single-salon-setup`, tres commits de resguardo). Se elimina el riesgo "no está en git" y el paso de `git init`.
10. **Entrega re-planificada en 9 slices (0, 1, 2, 2B, 3–7)**. **[Re-planificada de nuevo en Rev. 3: ver "Entrega por slices".]**

## Intent

La app no refleja cómo se trabaja de verdad: la asignación va directo a un uid, la visibilidad es solo de UI (`.read` global), no hay rastro de quién hizo qué, los cargos se definen de cero en cada evento y el evento no sabe cuándo empieza, cuándo se cierra ni cuándo queda inmutable. Necesitamos dos niveles: un **catálogo general de cargos y tareas** (plantilla reutilizable, más una configuración que sugiere cuántos meseros hacen falta según la cantidad de personas) y, por evento, el modelo **Evento → Equipo → Cargos asignados (snapshot del catálogo al asignar) → Tareas**, con permisos reales en las reglas, un **ciclo de vida derivado del reloj** (marcado habilitado solo en ventana, evento finalizado e inmutable), archivado, lista de invitados por evento con ventanas horarias y una auditoría append-only.

## Scope

### In Scope
- Usuarios: `inactivo`; solo el admin activa e inactiva (equivale a una baja). Un inactivo no puede loguearse ni ser elegido, y su historial se conserva.
- Catálogo global de cargos y tareas (pantalla "Cargos"), CRUD para admin y jefe. Tipos: `mesero` (`Mesero N`), `libre` (p. ej. `Portero`) y el genérico `apoyo`; cada cargo puede tener el permiso "maneja la lista de invitados" (Rev. 5).
- Configuración de meseros por cantidad de personas (pantalla "Configuración", solo admin): intervalos editables o modo libre. Solo produce un aviso de cuántos meseros se sugieren.
- Eventos (nombre, fecha, hora de inicio y de fin con cruce de medianoche, `personas` opcional): admin y jefe crean y editan; solo el admin borra o archiva.
- Ciclo de vida por tiempo (estado derivado del reloj, sin cron): marcado habilitado desde el inicio, cierre para meseros a fin + 2 h, finalizado e inmutable a fin + 4 h; reactivar (solo admin) con etiqueta "Reabierto".
- Detalle del evento ("Ingresar") con sus secciones.
- Equipo del evento con miembros registrados y "no registrados" (solo nombre); un mesero no puede estar en dos eventos que se crucen.
- Asignación de cargos: al asignar un cargo a una persona, el evento guarda su propia copia (nombre y tareas). Cargos numerados: una sola persona; `Apoyo`: varias. Tareas "sin responsable" reasignables solo dentro del evento.
- Vista del mesero: solo sus eventos (hoy primero) y las tareas de su cargo; marca y desmarca solo dentro de la ventana.
- Marcado delegado: admin o jefe marcan por un miembro no registrado o un cargo sin responsable.
- Archivar eventos pasados con datos (oculto de la lista, sin borrar nada); borrar solo lo futuro o lo pasado sin actividad.
- Invitados (Rev. 5): el admin sube un .xlsx que la app lee en el navegador; cada invitado es un registro en la RTDB (nombre, mesa, asistencia). Lista por mesas y completa, búsqueda sin tildes, marcar asistencia con contadores, re-subida que conserva las marcas. La manejan admin, jefe y titulares de cargos con el permiso, desde 1 h antes del inicio hasta finalizar.
- Auditoría por evento, append-only, de solo lectura para admin y jefe.
- Reescritura de `database.rules.json` con `.read` restringido y la ventana de marcado/inmutabilidad hecha cumplir con `now`.

### Out of Scope
- Sección protocolo, plantillas de evento, push, modo oscuro.
- Devolver al catálogo un cargo o tarea editado en un evento; propagar cambios del catálogo a eventos existentes.
- Cloud Functions, Cron, Storage o cualquier servicio nuevo de Firebase (el Excel se lee en el navegador, Rev. 5).
- ~~Parsear el Excel~~ (entra en el alcance en Rev. 5). Guardar el archivo original.
- Ocultar las tareas de otros cargos a nivel de reglas dentro de un mismo evento (ese filtro queda en la UI).
- **Pendiente / fuera del núcleo (Rev. 3, sin diseñar):** desmontaje, montaje e inventario. Ocurren fuera del horario del evento y el usuario aún no sabe cómo manejarlos. Incluye el tipo de cargo `desmontaje`, el nodo `inventario`, la sección "Desmontaje / Inventario" y el puntero `cargoDesmontajeId`. Los specs y el design conservan su contenido marcado como pospuesto.

## Capabilities

`openspec/specs/` está vacío, así que todas las capacidades son nuevas.

### New Capabilities
- `gestion-usuarios`: roles, activo/inactivo, bloqueo del login, pantalla global "Equipo".
- `catalogo-cargos`: catálogo global (plantilla) de cargos y sus tareas (pantalla "Cargos").
- `configuracion-meseros`: intervalos personas → meseros o modo libre (solo admin) y la sugerencia derivada.
- `eventos-equipo`: CRUD de eventos, ciclo de vida por tiempo, archivar/borrar, detalle, equipo del evento, membresía y visibilidad.
- `cargos-tareas`: asignación de cargos con snapshot, cargos "sin responsable", tareas, marcado propio y delegado, vista del mesero.
- `inventario-desmontaje`: **pospuesto, no implementar** (contenido conservado).
- `invitados-evento`: subir y leer el xlsx, lista por registros, búsqueda, marca de asistencia y re-subida con fusión, con acceso por cargo y ventana horaria (Rev. 5).
- `auditoria-evento`: log append-only, acciones registradas, revisión por evento.
- `reglas-seguridad`: helpers transversales y matriz de lectura y escritura.

### Modified Capabilities
None.

## Approach

### Modelo de datos (RTDB)
| Path | Contenido |
|---|---|
| `usuarios/{uid}` | `nombre, email, rol, estado: activo\|inactivo` |
| `catalogo/cargos/{ccid}` | `nombre, tipo: mesero\|libre\|apoyo, orden, manejaInvitados, actualizadoPor/En`, y anidado `tareas/{ctid}: {titulo, nota?, orden}`. (`desmontaje` pospuesto) |
| `config/meseroRangos` | `modo: rangos\|libre, rangos: {rid: {desde, hasta?, meseros}}, actualizadoPor/En` (`hasta` ausente = "o más") |
| `eventos/{eid}/info` | `nombre, fechaInicio, fechaFin` (`YYYY-MM-DDTHH:mm`; `fechaFin` ya cae al día siguiente si `horaFin <= horaInicio`), `inicioTs, finTs` (epoch ms, calculados por `calcularInstantes`), `personas?`, `reabierto?, reabiertoPor?, reabiertoEn?`, `archivado?, archivadoPor?, archivadoEn?`, `creadoPor/En`. **No hay `estado` guardado**: programado / en curso / cerrado para meseros / finalizado se derivan del reloj |
| `eventos/{eid}/equipo/{mid}` | `nombre, registrado, cargoInvitadosId?` (puntero a su cargo con permiso de lista, Rev. 5). `mid` es el uid si está registrado, o `nr_{pushId}` si no |
| `eventos/{eid}/cargos/{cid}` | **Snapshot** del cargo al asignarlo a una persona: `nombre, tipo, orden, manejaInvitados, titularId?` (un `mid`; ausente = sin responsable), `origenCatalogoId`. Un cargo numerado = un doc; `Apoyo` = un doc por persona |
| `eventos/{eid}/tareas/{tid}` | **Snapshot** de la tarea: `titulo, cargoId, nota?, orden, estado: pendiente\|hecho, origenCatalogoId?, auditId?` |
| `eventos/{eid}/ocupacion/{ccid}` | `cid`: índice de snapshot de cargos no `apoyo` (uno por cargo del catálogo y evento). Se escribe una vez; solo se borra junto con su cargo |
| `eventos/{eid}/actividad` | `true`: se escribe en todo marcado de una tarea y no se puede desfijar; define "tiene datos" para borrar vs. archivar |
| `membresias/{uid}/{eid}` | `true`: índice para que el mesero descubra sus eventos |
| `invitados/{eid}` | `meta: {nombreArchivo, total, subidoPor/En}`, `lista/{gid}: {nombre, nombreNorm, mesa?, orden, asistio, asistioPor?, asistioEn?, auditId?, removido?}` (Rev. 5; sin base64) |
| `auditoria/{eid}/{pushId}` | `accion, actorUid, paraMid?, objetivo, detalle, ts` |
| ~~`inventario/{itemId}`~~ | pospuesto, fuera del núcleo |

El catálogo va **anidado** (tareas dentro del cargo) y el evento **plano** (`tareas` con `cargoId`). Motivo: el catálogo solo lo tocan admin y jefe con una sola regla; en el evento, la regla del mesero se apoya en `tareas/$tid/estado` + lookup por `cargoId`, y mover una tarea de cargo es cambiar un campo. Ver D14 en el design.

### Cómo se arma un evento (Rev. 3)
1. El admin/jefe arma el equipo (registrados activos o no registrados).
2. A cada persona se le asigna un cargo del catálogo. En el mismo PATCH se crea el cargo del evento (copia de nombre) con sus tareas (copia) y el índice `ocupacion/{ccid} = cid`. Un cargo numerado con titular se rechaza; `Apoyo` se puede asignar a varias personas a la vez (cada una recibe su cargo con su copia de las tareas genéricas).
3. La sugerencia de la configuración solo muestra un aviso ("se sugieren 8 meseros; tienes 6"). Si hay menos personas que cargos, solo se guardan los cargos con persona; los cargos del catálogo sin titular en el evento aparecen con sus tareas como **"sin responsable"** (vista derivada, no se guarda nada), igual que los snapshots cuyo titular se quitó o se inactivó. Admin/jefe las reasignan solo dentro del evento: copian la tarea a un cargo del evento o la mueven. No toca el catálogo ni crea cargos.
4. Si hay más personas que cargos, las que sobran toman `Apoyo`.

### Estrategia de reglas
- Helpers: `activo(auth)`, `esAdmin`, `esJefeOAdmin`, `esMiembro(eid)`, y de tiempo: `iniciado = now >= info/inicioTs`, `ventanaMesero = iniciado && now <= info/finTs + 2 h`, `editable = now <= info/finTs + 4 h || info/reabierto === true`.
- Se elimina el `.read` raíz. `catalogo`: lectura y escritura solo jefe o admin. `config`: lectura jefe o admin, escritura solo admin. Lectura de `eventos/{eid}`: jefe o admin, o miembro. Las RTDB rules no filtran consultas, por eso existe el índice `membresias`.
- Todo lo editable de un evento (`info`, `equipo`, `cargos`, `tareas`, `ocupacion`) exige `editable` (finalizado = inmutable). Los campos `reabierto*` y `archivado*` solo los escribe el admin.
- Borrar `eventos/{eid}`: solo admin y `!actividad.exists() || now <= info/finTs` (niega si falta `finTs`). Eso hace cumplir "pasado con datos solo se archiva"; además `actividad` no se puede desfijar y las fechas de un evento pasado con datos quedan congeladas.
- Marcar una tarea: el mesero titular dentro de `ventanaMesero` y solo cambia `estado` (+ `auditId`, acoplado a su entrada de auditoría); jefe y admin marcan si `editable`.
- Lista de invitados (Rev. 5): admin siempre (solo él crea, borra y re-sube registros); jefe y titulares de un cargo con `manejaInvitados` leen y marcan asistencia desde `inicioTs − 1 h` hasta finalizar (ventana propia, no la de tareas). El acceso del titular se comprueba con el puntero `equipo/{mid}/cargoInvitadosId`, re-verificado por las reglas. Cada marca es un PATCH por invitado acoplado a su auditoría.
- Auditoría: `!data.exists()`, `actorUid === auth.uid`, `ts === now`. No se puede actualizar ni borrar. El mesero solo agrega `tarea.marcar` acoplada a su marcado.
- Cada acción de un evento se escribe junto con su auditoría en un único PATCH multi-path a la raíz (pushIds generados en el cliente).

### Mapeo de supuestos
- Cuando un inactivo se loguea, el cliente cierra la sesión; las reglas niegan todo. Auth sigue existiendo porque no hay Admin SDK.
- Mesero inactivado con eventos futuros: sigue en el equipo del evento (marcado "Inactivo") y sus tareas se muestran "sin responsable" (derivado; `titularId` se conserva para la auditoría).
- Sacar a alguien del equipo borra en el mismo PATCH su `equipo`, su `membresias` y su `titularId` (el snapshot del cargo y su `ocupacion` quedan, "sin responsable"). La auditoría lo conserva.
- Un mesero no puede estar en dos eventos que se crucen en horario: lo valida el cliente al agregarlo y al editar fechas (las reglas no pueden comparar eventos).
- Los cambios de la configuración y del catálogo no se auditan por evento: guardan `actualizadoPor/En` (Q4).
- "Tiene datos" = existe `eventos/{eid}/actividad` (se escribe en todo marcado; no se desfija). Supuesto a confirmar (Q11).

### Entrega por slices (Rev. 3; cada uno se puede publicar solo)
0. **Setup**: emulador, mocks de test, `@angular/fire`/`firebase` en `package.json`, backup de reglas.
1. **Usuarios inactivo + reglas base**.
2. **Catálogo "Cargos"** (tipos `mesero|libre|apoyo`, con el permiso `manejaInvitados`; Rev. 5).
2B. **Configuración de meseros**.
3. **Detalle del evento + equipo del evento + visibilidad + auditoría** (incluye el modelo de instantes `inicioTs/finTs`).
3B. **Ciclo de vida por tiempo + archivar/borrar** (nuevo).
4. **Asignación de cargos (snapshot) + tareas + marcado + vista del mesero** (ya no copia el catálogo entero).
5. **Lista de invitados** (antes slice 6; Rev. 5: lectura del Excel en el navegador, registros, asistencia y re-subida).
6. **Visor de auditoría + barrido final** (antes slice 7; sin snapshot de inventario).
- **Pendiente / fuera del núcleo**: Desmontaje + inventario (antes slice 5).

**Restricción de entrega:** si el salón empieza a trabajar eventos reales antes de terminar, los slices **2, 3, 3B y 4 se publican juntos**: el 2 borra la vista "Mis tareas" del mesero y el 4 la reemplaza; el 3 restringe la lectura de `eventos`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/core/models/dominio.models.ts` | Modified | Agrega `CargoCatalogo`, `TareaCatalogo`, `Cargo`, `MiembroEquipo`, `EntradaAuditoria`, `MetaInvitados`, `Invitado` (Rev. 5), `estado` inactivo e instantes del evento. Quita `Participante`, `asignadoA`, `desmontajeAsignadoA` y los campos viejos de evento |
| `src/app/core/services/*` | Modified/New | event, task se reescriben; catalogo, equipo, cargo, audit e invitados son nuevos; también user y auth. `inventory.service.ts` se borra y NO se re-crea (pospuesto) |
| `src/app/core/logica/*` | New | Funciones puras: push-id, patch-builder, numeración, asignación de cargos (snapshot), permisos, ciclo de vida (`calcularInstantes`, `estadoEvento`), cruce de horarios, auditoría, parser y fusión de la lista de invitados, adaptador de lectura de .xlsx |
| `src/app/core/guards/*` | Modified | rol; agrega el chequeo de inactivo. El guard de inventario se borra |
| `src/app/page/eventos`, `page/admin/equipo` | Modified | Eventos: lista por rol/fecha, "Ingresar", archivar; Equipo suma activo/inactivo |
| `src/app/page/cargos/` (nueva) | New | Catálogo global |
| `src/app/page/admin/configuracion/` (nueva) | New | Intervalos de meseros (solo admin) |
| `src/app/page/eventos/detalle/**` (nueva) | New | Secciones del evento |
| `src/app/page/tareas/**`, `page/inventario/*` | Deleted | Reemplazados por el catálogo y el detalle del evento |
| `src/app/shared/nav-items.ts`, `src/app/app.routes.ts` | Modified | Menú Eventos · Equipo · Cargos (+ Configuración del admin); rutas del detalle |
| `database.rules.json` | Modified | Reescritura completa |
| `package.json`, `firebase.json` | Modified | Dependencias de Firebase; `read-excel-file` (slice 5, Rev. 5); emuladores |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Las reglas no se pueden testear con Karma; un lookup mal hecho abre o cierra accesos | High | Emulador de Firebase y checklist REST por rol y slice antes de cada deploy |
| Comportamientos de reglas sin verificar: `child(null)`, validación por hoja en PATCH multi-path, `ts === now` vía REST, `now` contra `inicioTs/finTs` en cada hoja, `editable` durante la creación del evento | Med | Prueba en emulador en los slices 1, 3 y 3B |
| `src/` importa `@angular/fire` pero `package.json` no lo declara; además 18.0.1 apunta a otra major de `firebase` que la instalada (12.17.1) | High | Slice 0 |
| `database.rules.json` local tiene una edición NO desplegada (`info` no borrable por el jefe) | Med | Backup de las reglas vivas antes del primer deploy |
| La auditoría la escribe el cliente: un usuario técnico puede falsearla | Med | Aceptado a esta escala |
| El reloj del dispositivo decide `inicioTs/finTs` al crear; las reglas usan `now` del servidor | Low | Solo admin y jefe escriben `info`; la ventana la hace cumplir el servidor contra esos valores |
| "Finalizado" se calcula en el cliente; sin cron no hay escritura que lo marque | Low | Las reglas lo hacen cumplir con `now`; la UI solo lo refleja |
| Zona horaria: `inicioTs/finTs` salen de la hora local del dispositivo de quien crea | Low | Un solo salón/zona; función pura testeada con fechas fijas |
| Los cruces de horario del mesero solo los valida el cliente | Low | Se valida al agregar y al editar fechas; no es tema de seguridad |
| (Rev. 5) Un invitado cuyo nombre empiece con el apellido "Mesa" se toma como título de mesa (regla del parser) | Low | Previsualización con conteo por mesa antes de confirmar; el admin corrige el archivo |
| (Rev. 5) Librería de lectura de .xlsx con historial de vulnerabilidades (SheetJS de npm: prototype pollution y ReDoS) | Med | `read-excel-file` (MIT) con `import()` dinámico; verificar versión y advisories al instalar; solo el admin sube archivos |
| (Rev. 5) Una re-subida borra un invitado que alguien marcó entre la lectura y el PATCH | Low | Releer justo antes; la marca queda en la auditoría |
| Los flags denormalizados (`cargoInvitadosId`, `membresias`, `titularId`, `ocupacion`, `actividad`) pueden quedar desincronizados | Med | Siempre en un PATCH multi-path, con lógica en funciones puras testeadas |
| Las tareas de otros cargos se pueden leer dentro del mismo evento | Low | Documentado; el filtro es de UI |
| Un inactivo conserva su cuenta de Auth | Low | Las reglas son el bloqueo real |

## Rollback Plan

- Antes de cada deploy, guardar una copia de las reglas vigentes (las de la consola, no el archivo local) y volver a desplegarla si algo falla.
- Datos: no hay migración. Revertir = borrar `catalogo`, `config`, `eventos`, `membresias`, `invitados` y `auditoria`, y el campo `estado: inactivo` de los usuarios. Los eventos de prueba actuales se pueden borrar.
- Código: el repo está en git (rama `feat/milan-single-salon-setup`): revertir por slice con un commit por slice (cada commit, con aprobación del usuario).

## Dependencies

- Firebase CLI con emulador de RTDB y Auth.
- Infraestructura de specs: mocks de `RtdbService` y `AuthService` para strict TDD.

## Success Criteria

- [ ] Un mesero solo lista y lee los eventos donde está en el equipo; la REST API le niega cualquier otro y el catálogo (verificado en emulador).
- [ ] Asignar un cargo a una persona crea en el evento su propia copia (cargo y tareas); editar o borrar después el catálogo no cambia ningún evento existente.
- [ ] Un cargo numerado solo lo ocupa una persona (la app y las reglas rechazan el segundo); `Apoyo` admite varias.
- [ ] Con intervalos configurados y un evento de N personas, la app avisa cuántos meseros se sugieren frente a los asignados; en modo libre o sin `personas` no sugiere nada. Solo el admin escribe la configuración.
- [ ] Un mesero solo marca las tareas de su cargo y solo entre la hora de inicio y fin + 2 h; antes del inicio o después de ese límite las reglas lo rechazan.
- [ ] A fin + 4 h el evento queda inmutable (reglas); solo el admin lo reactiva, con etiqueta "Reabierto" y auditoría de quién y cuándo.
- [ ] Un evento que cruza medianoche (22:00 a 03:00) termina al día siguiente.
- [ ] Un inactivo no puede loguearse ni ser elegido, y sus entradas de auditoría siguen visibles; sus tareas pasan a "sin responsable".
- [ ] Solo el admin borra; un evento pasado con datos solo se archiva (la regla lo impide).
- [ ] (Rev. 5) El admin sube el xlsx real ("ASISTENTES EVENTO NATHALIA.xlsx"), ve la previsualización por mesa y confirma; quedan ~107 registros agrupados en 11 mesas. Jefe y titulares de un cargo con el permiso ven la lista, buscan sin tildes y marcan asistencia desde 1 h antes hasta que el evento se finalice (dos personas a la vez sin conflictos); el resto recibe 403. Una re-subida corregida conserva las marcas.
- [ ] Cada asignación, edición de cargos y tareas del evento, marcado (incluido el delegado), reactivación, archivado, subida o re-subida de la lista y marca de asistencia deja una entrada de auditoría que nadie puede editar ni borrar.
- [ ] El admin puede revisar un evento y ver, por persona, sus cargos, quién se los asignó y qué marcó.

## Open Questions

1. ~~Estado del inventario (Q1)~~ **Pospuesta** con el inventario.
2. ~~Admin/jefe editan inventario si el titular no está registrado (Q2)~~ **Pospuesta**.
3. ~~Un solo Desmontaje (Q3)~~ **Pospuesta**.
4. Activar, inactivar, promover, editar el catálogo y editar la configuración son acciones globales: ¿van a una auditoría global o alcanza con `estadoCambiadoPor/En` y `actualizadoPor/En`? (default: alcanza)
5. ¿El jefe ve "Equipo" en el menú (solo lectura) o es solo del admin? (default: solo admin, como el código actual)
6. ~~Lectura del inventario (Q6)~~ **Pospuesta**.
7. ~~Plantillas `Mesero` faltantes en la copia (Q7)~~ **Reemplazada**: ya no hay copia del catálogo; los que sobran toman `Apoyo`.
8. ~~(Rev. 3, supuesto) Portero descarga el xlsx desde 1 hora antes~~ **Reemplazada por el usuario (Rev. 5)**: no hay figura "Portero"; acceso por cargo con permiso.
9. ~~(supuesto) Copia de tareas por persona en `Apoyo`~~ **Resuelta por el usuario**: cada persona con `Apoyo` tiene su propia copia.
10. ~~(supuesto) "Sin responsable" = cargos activados~~ **Resuelta por el usuario (Rev. 4)**: los cargos del catálogo sin titular en el evento aparecen con sus tareas "sin responsable" (vista derivada) y admin/jefe las reasignan solo dentro del evento.
11. (Rev. 3, supuesto) "Tiene datos" = hubo al menos un marcado de tarea (`actividad`). Subir invitados o asignar cargos no cuenta. Confirmar.
12. (Rev. 3, supuesto) Entre fin + 2 h y fin + 4 h admin y jefe aún pueden marcar y editar; antes del inicio también. Confirmar.
13. (Rev. 3, supuesto) El cruce de horarios de un mesero se bloquea al agregarlo (no solo avisa). Confirmar.
14. (Rev. 3) "Finalizar" manual: solo cierra un evento reabierto (el finalizado normal es por reloj). ¿Hace falta finalizar a mano uno que aún no pasó? (default: no)
15. ~~Cargo propio solo para el evento~~ **Descartada por el usuario**: no es una opción.
16. Al borrar un evento su auditoría queda huérfana (legible solo por clave). ¿Aceptable?
17. (Rev. 4) Las tareas derivadas "sin responsable" que nadie reasignó no quedan registradas al finalizar (no hay servidor). ¿Hace falta? (default: no)
18. (Rev. 4) La vista derivada muestra todos los cargos del catálogo sin titular, aunque el evento sea chico. ¿Se limitan los `Mesero N` a la cantidad sugerida? (default: no)
19. **(Rev. 5, ABIERTA, sin decidir)** ¿La lista de invitados (subida o marcas de asistencia) cuenta como "dato" para bloquear el borrado del evento? Hoy no escribe `actividad`.
20. (Rev. 5, supuesto) En una re-subida, un invitado ya marcado que desaparece se conserva como "removido de la lista" con su marca. Confirmar.
21. (Rev. 5, supuesto) Evento reabierto: el jefe maneja la lista, los titulares de lista no; el admin en cualquier momento. Confirmar.
22. (Rev. 5, supuesto) Admin y jefe activan el permiso en el catálogo y pueden cambiarlo en un cargo ya asignado (solo ese evento). Confirmar.
23. (Rev. 5, supuesto) Desaparece el tipo de cargo `portero` ("Portero" = cargo `libre`); límites de 500 invitados, 1 MiB y nombres ≤ 120; duplicados se conservan con aviso. Confirmar.

## Revisión 3 (2026-10-15)

Qué cambió y por qué (decisiones del usuario, autoritativas). Reemplaza lo que contradiga en las revisiones anteriores:

1. **El catálogo es plantilla; no se copia entero ni se crean cargos por evento por adelantado.** Lo que cambia por evento es *quién ocupa qué cargo*. Al asignar un cargo a una persona, el evento guarda su **propia copia (snapshot)** del nombre y las tareas de ese momento. Editar o borrar el catálogo después no afecta eventos existentes ni pasados. Esto reemplaza "Copiar cargos del catálogo" (Rev. 2, punto 5) y `construirCopiaCatalogo`.
2. **Menos personas que cargos** (van 4 de 5): solo se activan los cargos con persona; las tareas de un cargo sin titular quedan "sin responsable" y admin/jefe las reasignan, solo dentro del evento. **Más personas que cargos** (7 de 5): el catálogo trae un cargo genérico `Apoyo`, asignable a varias personas a la vez; no se inventa "Mesero 6". Un cargo numerado lo ocupa una sola persona (la app avisa y no deja; también lo impide `ocupacion` en las reglas).
3. **Los rangos de invitados → meseros siguen siendo solo sugerencia** (Rev. 4: solo un aviso; no se activan cargos).
4. **Portero = usuario registrado común** con el cargo Portero. Roles fijos: administrador, jefe_mesero, mesero. Se sigue permitiendo "no registrado" (solo nombre); sus tareas las marca admin/jefe. El jefe puede ser titular de un cargo y crear/eliminar tareas del evento.
5. **Qué ve cada rol.** Mesero: solo eventos donde está en el equipo, por fecha, el de hoy primero y destacado (si hoy tiene uno solo, se abre directo); dentro ve solo las tareas de su cargo; no hay eventos que se crucen. Usuario sin asignaciones: "No tienes eventos ni cargos asignados". Admin/jefe: eligen equipo, asignan cargos, ven en vivo lo hecho y lo "sin responsable", y reasignan.
6. **Ciclo de vida por tiempo, derivado del reloj (sin servidor ni cron).** Antes del inicio: ve pero no marca. Desde el inicio: marca. Fin + 2 h: se cierra el marcado de meseros. Fin + 4 h: **finalizado e inmutable**, calculado comparando con el horario. Si `horaFin <= horaInicio` el fin cae al día siguiente (el modelo ahora guarda instantes `inicioTs/finTs`). Las reglas (que tienen `now`) hacen cumplir la ventana, no solo la UI. Reactivar: **solo el admin**; queda abierto para admin y jefe hasta que el admin lo cierre a mano con Finalizar; los meseros siguen sin marcar; etiqueta "Reabierto" y auditoría de quién y cuándo (antes lo hacían admin y jefe).
7. **Borrar vs. archivar.** Solo el admin borra. Un evento pasado con datos (hubo marcados) **no se borra, se archiva** (oculto de la lista principal, sin borrar nada). Evento futuro o pasado sin actividad: se puede borrar. "Tiene datos" se detecta con el flag `eventos/{eid}/actividad`, que las reglas consultan.
8. **Invitados (Excel).** El admin sube en cualquier momento (antes también el jefe). Jefe y Portero descargan desde 1 h antes del inicio; el mesero elegido o "todos", desde 10 min antes; todos hasta que el evento se finalice. Sigue siendo solo RTDB.
9. **Sacado del núcleo (pendiente, sin diseñar):** desmontaje, montaje e inventario. Ocurren fuera del horario del evento y el usuario aún no sabe cómo manejarlos. Se retira el slice 5 del plan activo (queda en "Pendiente / fuera del núcleo" de `tasks.md`), `inventario-desmontaje` queda "pospuesto, no implementar" y el tipo de cargo `desmontaje` sale del alcance del núcleo. El resto de los slices se renumera (Invitados = 5, Auditoría + cierre = 6) y se agrega el 3B (ciclo de vida, archivar/borrar).
10. **Se mantiene:** auditoría append-only por evento (nadie borra, admin lee, jefe solo lectura), registro de mesero directo y activo, admin no asignable, admin activa/inactiva meseros, y los defaults previos pendientes de confirmar (el jefe no ve Equipo en el menú, etc.).

## Revisión 5 (2026-10-15): lista de invitados y permisos

Decisiones del usuario (autoritativas; reemplazan lo que contradiga en Rev. 3 punto 4 y 8 y en el cuerpo):

1. **Roles fijos: administrador, jefe_mesero y trabajador.** El id interno sigue siendo `mesero` (no se tocan las reglas de `usuarios` desplegadas); la UI dice "Trabajador". Portero, mesero, etc. son **cargos** del catálogo. Se elimina el tipo de cargo `portero` y la figura especial "Portero".
2. **Permiso por cargo "maneja la lista de invitados"** (`manejaInvitados`, se copia en el snapshot). Quien tenga en el evento un cargo con el permiso abre la lista, la ve por mesas, busca y marca asistencia desde 1 h antes del inicio hasta que el evento se finalice. Sin cargos con permiso, solo la ven admin y jefe. Se eliminan la ventana de 10 minutos del mesero, `verInvitados`, `invitadosTodos` y el flag `portero`.
3. **Subida y lectura del Excel.** Solo el admin sube, en cualquier momento. La app lee el .xlsx en el navegador (librería cliente, sin backend) y guarda cada invitado como un registro (`nombre`, `mesa` o null, `asistio`, `asistioPor/En`). Marcar asistencia es una escritura atómica por invitado, concurrente y auditada; **usa la ventana de la lista, no la de tareas** (decisión explícita, D27).
4. **Funciones:** por mesas, todos, búsqueda sin tildes ni mayúsculas, marcar/desmarcar, contadores "llegaron / total" global y por mesa. Exportar es opcional.
5. **Formato real del Excel:** una hoja, columna A, títulos `MESA PRINCIPAL`, `MESA 1`…`MESA 10` (a veces con espacios al final o sin fila vacía antes), nombres debajo, sin columnas de asistencia. Un texto que empieza con "MESA" abre mesa; sin títulos, todos sin mesa; también se acepta un xlsx con encabezados `nombre`/`mesa`. Casos borde en `invitados-evento`.
6. **Re-subida con fusión:** los ya marcados conservan su marca (pareja por nombre normalizado + mesa, o por nombre único si cambió la mesa); los marcados que desaparecen quedan como "removidos de la lista" (supuesto, Q20); todo auditado.
7. **Se mantiene todo lo demás** (ciclo de vida por horas, snapshot por asignación, cargo numerado de un titular, `Apoyo` múltiple, tareas sin responsable, archivar vs. borrar, desmontaje/inventario pospuesto, reactivar solo admin).
8. **Duda abierta (Q19):** si la lista cuenta como "dato" para bloquear el borrado del evento. No se decide.
