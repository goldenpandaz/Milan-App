# Tasks: core-eventos

> Revisión 3: el catálogo es plantilla y el evento guarda un snapshot por cargo al asignarlo (ya no se copia el catálogo entero); ciclo de vida por tiempo, archivar y ventanas de invitados. Desmontaje + inventario salen del plan activo (ver "Pendiente / fuera del núcleo" al final). Slices: 0, 1, 2, 2B, 3, 3B, 4, 5 (Invitados), 6 (Auditoría + cierre). Ver el changelog en `proposal.md`.

> **Revisión 5 (lista de invitados y permisos):** roles fijos administrador / jefe_mesero / trabajador (id `mesero`, etiqueta "Trabajador"); el tipo de cargo `portero` desaparece; permiso por cargo `manejaInvitados` con puntero `equipo/{mid}/cargoInvitadosId`; el .xlsx se lee en el navegador y cada invitado es un registro con marca de asistencia. Cambian tareas de los slices 1, 2, 3 y 4 (sin renumerar) y el slice 5 se reescribe (7 → 15 tareas). Ver D9, D10, D24–D27 del design.

> **Revisión 6 (cargos por evento):** al primer ingreso de admin/jefe el evento copia el catálogo completo (D28) y desde ahí lo edita aislado: crear/renombrar/eliminar cargos (D31) y mover tareas entre cargos (D30); un titular por cargo con `ocupacion/{cid}` LOCAL (D29). Se eliminan el cargo `Apoyo`, el `tipo` de cargo, el snapshot al asignar y `tarea.cubrir`. Cambian 2.1, 2.4, 2.5, 2.7, 2.10 y el slice 4 se reescribe (14 → 17 tareas).

Convenciones: TDD = RED (spec de Karma) → GREEN → REFACTOR. Lógica pura en `src/app/core/logica/`. Ninguna tarea corre un build. Las reglas no se testean con Karma: cada tarea de reglas tiene su tarea de checklist en el emulador por REST (resultados en `openspec/changes/core-eventos/rules-checklist.md`). Copy de UI en tuteo, nombres en español.
`[ASK]` = necesita aprobación explícita del usuario antes. `[Q#]` = depende de una decisión abierta (se implementa el default salvo que el usuario diga otra cosa).
Commits: el repo está en git (rama `feat/milan-single-salon-setup`). Un commit por slice, convencional, sin atribución de IA y siempre `[ASK]`.

Decisiones abiertas vigentes: **Q4** auditoría global para usuarios/catálogo/configuración (default: no, solo `…Por/En`); **Q5** el jefe ve "Equipo" en el menú (default: no); **Q11** "tiene datos" = hubo un marcado (`actividad`) (supuesto); **Q12** admin/jefe marcan y editan antes del inicio y hasta fin + 4 h (supuesto); **Q13** el cruce de horarios bloquea (supuesto); **Q14** "Finalizar" a mano solo cierra un evento reabierto (default); **Q16** auditoría huérfana al borrar (default: aceptable); **Q19** ¿la lista de invitados cuenta como "dato" para bloquear el borrado? (ABIERTA, sin default: hoy no escribe `actividad`); **Q20** invitado marcado que desaparece en una re-subida queda `removido` con su marca (supuesto); **Q21** reabierto: jefe sí maneja la lista, titulares de lista no; admin en cualquier momento (supuesto); **Q22** admin y jefe activan `manejaInvitados` en el catálogo y en un cargo ya asignado (supuesto); **Q23** sin tipo `portero`; 500 invitados, 1 MiB, nombres ≤ 120, duplicados con aviso (supuesto).
Reemplazada por el usuario (Rev. 5): **Q8** (no hay figura "Portero"; acceso por cargo con permiso).
Resueltas por el usuario: **Q10** (ajustada en Rev. 6) cargos del evento sin titular = tareas "sin responsable", se resuelven moviendo tareas o asignando titular; **Q15** revertida en Rev. 6 (sí hay cargos creados solo en el evento). Obsoletas en Rev. 6: **Q9** (no existe `Apoyo`), **Q17**, **Q18** (no hay vista derivada), **Q7**.
Pospuestas con el inventario: Q1, Q2, Q3 (Desmontaje único), Q6.
Revisión 4/5/6: ver "Viabilidad de reglas" al final de `design.md` (V1–V22).

**Restricción de entrega:** si el salón trabaja eventos reales con la app antes de terminar, los slices **2, 3, 3B y 4 se publican juntos** (el 2 borra la vista de tareas del mesero y el 4 la reemplaza; el 3 restringe la lectura de `eventos`). Hoy la DB solo tiene datos de prueba, así que cada slice puede salir solo.

## Ya hecho (no se replanifica)

- [x] Modelo de 3 roles (`administrador`, `jefe_mesero`, `mesero`) con alta directa como mesero; flujo "pendiente" eliminado; reglas de `usuarios` desplegadas.
- [x] Providers de Firebase en `app.config.ts` y `scripts/set-env.js` que genera la apiKey.
- [x] `shared/components/segmented-control` usado en `page/admin/equipo` (mesero↔jefe), orden admin → jefe → mesero, update optimista.
- [x] Pantalla Eventos: editar (admin y jefe), borrar (solo admin, modal de confirmación, cascada secuencial), botón "Ingresar" placeholder, sin "Marcarme disponible".
- [x] Menú sin "Asignar".
- [x] `database.rules.json` local: `info` no borrable por el jefe (editado, **sin desplegar**; lo incorpora la tarea 1.11).
- [x] Git: el proyecto es un repo con tres commits de resguardo.

## Slice 0: Setup (6)

- [ ] 0.1 [ASK] `package.json`: declarar `@angular/fire` y `firebase` en `dependencies` (instalados 18.0.1 y 12.17.1; `app.config.ts` y `auth.service.ts` ya los importan, un `npm install` limpio rompería). AC: revisar `peerDependencies` en `node_modules/@angular/fire/package.json`; si 18.0.1 no admite firebase 12, el usuario decide fijar la versión compatible o actualizar; no correr `npm`.
- [ ] 0.2 `firebase.json`: agregar `"emulators": {"database":{"port":9000},"auth":{"port":9099}}`. AC: JSON válido, config existente intacta.
- [ ] 0.3 Crear `src/app/testing/rtdb.service.mock.ts` (`jasmine.createSpyObj<RtdbService>` que devuelve `of(...)`, incluye `patchRaiz`/`getShallow`). AC: factory reutilizable.
- [ ] 0.4 Crear `src/app/testing/auth.service.mock.ts` (stub de sesión con uid, rol, estado). AC: factory reutilizable.
- [ ] 0.5 [ASK] Backup de reglas: pedirle al usuario las reglas vivas (consola de Firebase → Realtime Database → Reglas) y guardarlas en `openspec/changes/core-eventos/backup/database.rules.deployed.json`; copiar además el archivo local como `database.rules.local.json`. AC: ambos existen; se anota la diferencia (la edición de `info`).
- [ ] 0.6 Crear el esqueleto de `openspec/changes/core-eventos/rules-checklist.md`: arranque del emulador, usuarios sembrados (admin, jefe, mesero A miembro, mesero B no miembro, inactivo), idToken con `signInWithPassword`, siembra con `?auth=owner`, filas para V1–V22 y celdas de la matriz (incluye catálogo, configuración, borrado solo admin y ventanas de tiempo). AC: tabla con status esperado y columna de resultado vacía.

## Slice 1: Usuarios inactivo + reglas base (16)

- [ ] 1.1 `dominio.models.ts`: `EstadoUsuario` +`inactivo`; `Usuario` +`estadoCambiadoPor?/En?`. AC: compila por inspección.
- [ ] 1.2 RED `rtdb.service.spec.ts`: `patchRaiz` hace PATCH a `/.json`, `getShallow` agrega `?shallow=true`. GREEN en `rtdb.service.ts`. AC: specs pasan.
- [ ] 1.3 Quitar `getByChild` de `rtdb.service.ts` si no tiene llamadores (Grep). AC: cero referencias colgando.
- [ ] 1.4 RED `auth.service.spec.ts`: perfil inactivo en login/refresh → `signOut`, logout y mensaje en tuteo; activo pasa. AC: falla primero.
- [ ] 1.5 GREEN `auth.service.ts`: chequeo de inactivo en `cargarPerfilYGuardar`/`refrescarSesion`; borrar el `mensajeError` muerto. AC: 1.4 pasa.
- [ ] 1.6 RED+GREEN `user.service.spec.ts` / `user.service.ts`: `listarElegibles` (solo activos), `cambiarEstado(uid, estado, adminUid)` con `estadoCambiadoPor/En`; conservar `listarEquipo` y `asignarRol`; borrar `listarActivosPorRol` (sin uso). [Q4] AC: payload exacto verificado.
- [ ] 1.7 RED+GREEN `core/interceptors/sesion-inactiva.interceptor.ts` (+spec): 401/403 de la RTDB → `refrescarSesion()`, logout si quedó inactivo. Registrar en `app.config.ts`. AC: spec pasa.
- [ ] 1.8 RED+GREEN `guards/auth.guard.ts` (exige `estado==='activo'`) y `rol.guard.ts` (redirige a `/app/eventos`, hoy va a `/app/tareas`), con specs. AC: inactivo bloqueado.
- [ ] 1.9 `login.component`: mensaje de inactivo. AC: "Tu cuenta está inactiva, habla con el administrador".
- [ ] 1.10 RED+GREEN `event.service.ts` `eliminar` → un solo `patchRaiz({'eventos/E': null})` (D17; la cascada secuencial actual probablemente da 403: ninguna regla otorga `.write` en `participantes|tareas|inventario`). AC: spec verifica el `Updates` exacto. (La condición "pasado con datos solo se archiva" llega en 3B.)
- [ ] 1.11 `database.rules.json` S1: helpers (`ACTIVO`/`ADMIN`/`JEFE_O_ADMIN`), sin `.read` raíz, `usuarios` según el design (inactivo, el admin no se edita a sí mismo), legacy `eventos/*` con `ACTIVO` (`.read` en `eventos` = `ACTIVO`), `eventos/$eid .write = ADMIN && !newData.exists()`, `info .write = JEFE_O_ADMIN && newData.exists()`. AC: JSON válido, coincide con la tabla del design.
- [ ] 1.12 Checklist en el emulador: `usuarios`, GET raíz 403, inactivo 403, jefe borra evento 403, admin borra evento 200, V1, V2; anotar en `rules-checklist.md`. AC: todas las filas pasan.
- [ ] 1.13 [ASK] Deploy de reglas: confirmar backup 0.5, aprobación explícita, deploy. AC: aprobación registrada.
- [ ] 1.14 `page/admin/equipo`: toggle activo/inactivo (modal de confirmación "¿Dar de baja a {nombre}?") y sección de inactivos; mantiene `SegmentedControl` y orden. Ruta y etiqueta "Equipo" sin cambios. (Rev. 5) El rol `mesero` se muestra como "Trabajador" en toda la UI (control segmentado "Trabajador / Jefe", badges, registro) con una constante/función `etiquetaRol`; el id interno no cambia. AC: el admin no ve controles sobre sí mismo; no aparece "Mesero" como nombre de rol.
- [ ] 1.15 Smoke test manual en mobile: login de inactivo, toggle, rol. AC: anotado en el checklist.
- [ ] 1.16 [ASK] Commit del slice (`feat(usuarios): ...`).

## Slice 2: Catálogo "Cargos" (14)

- [ ] 2.1 `dominio.models.ts`: `CargoCatalogo` (con `manejaInvitados: boolean`, **sin `tipo` ni `variasPersonas`**, Rev. 6; ya en el código), `TareaCatalogo`; borrar el `ItemInventario` viejo. AC: coincide con el esquema.
- [ ] 2.2 RED+GREEN `core/logica/push-id.ts` (+spec): largo 20, orden por tiempo, reloj/random inyectables.
- [ ] 2.3 RED+GREEN `core/logica/patch-builder.ts` (+spec): `set/remove/build`, superposición lanza (V6). (`audit()` llega en 3.2.)
- [ ] 2.4 RED+GREEN `core/logica/numeracion.ts` (+spec): `siguienteNombreMesero` (por nombre `Mesero N`: huecos → max+1, ignora los demás; Rev. 6: lo usa la sugerencia de "+ Cargo" del evento), `siguienteOrden`.
- [ ] 2.5 RED+GREEN `core/logica/catalogo.ts` (+spec): `ordenarCatalogo` (raw RTDB → arreglo ordenado con tareas). Sin `esMultiTitular` (Rev. 6) ni `puedeAgregarDesmontaje` (pospuesto).
- [ ] 2.6 RED+GREEN `catalogo.service.ts` (+spec): `listar`, `crearCargo` (con `manejaInvitados = false`), `actualizarCargo` (incluye `manejaInvitados`), `eliminarCargo` (un path, arrastra tareas; no toca eventos), `crearTarea`, `editarTarea`, `eliminarTarea`; toda escritura incluye `actualizadoPor/En` del cargo (`{'.sv':'timestamp'}`). AC: `Updates` exacto; nunca escribe bajo `eventos/`.
- [ ] 2.7 `database.rules.json` S2: `catalogo` (`.read`/`.write` `JEFE_O_ADMIN`, validaciones de cargo y tarea, sin `tipo` (Rev. 6; `$other: false`), `manejaInvitados` bool); quitar la regla legacy `eventos/$eid/inventario`. AC: coincide con el design.
- [ ] 2.8 Checklist: jefe/admin 200, mesero 403, V8 (tarea con y sin `actualizadoPor/En`), segundo `$other` rechazado. AC: todas pasan.
- [ ] 2.9 [ASK] Deploy de reglas (backup + aprobación).
- [ ] 2.10 UI `page/cargos/`: `CatalogoCargosComponent` (container) + `CargoCatalogoCardComponent` (presentacional, acordeón): alta de cargo con nombre libre (Rev. 6: sin "+ Apoyo" ni tipos), toggle "Este cargo maneja la lista de invitados", renombrar, borrar con confirmación ("Los eventos existentes no cambian"), alta/edición/baja de tareas. AC: split container/presentational.
- [ ] 2.11 `app.routes.ts` + `nav-items.ts`: `/app/cargos` con `rolGuard('jefe_mesero')`; menú admin Eventos · Equipo · Cargos, jefe Eventos · Cargos, mesero Eventos [Q5]. AC: sin ítems Tareas/Mis tareas.
- [ ] 2.12 Borrar `page/tareas/tareas.component.*`, `page/inventario/*`, `guards/inventario.guard.ts`, `inventory.service.ts` y sus rutas (`/app/tareas`, `/app/inventario`); no se re-crean (inventario pospuesto). Asignar (`/app/tareas/asignar`) queda solo por URL hasta 4.16. AC: Grep sin referencias a lo borrado.
- [ ] 2.13 Smoke test manual en mobile (jefe y admin crean el catálogo; mesero no ve Cargos). AC: anotado.
- [ ] 2.14 [ASK] Commit del slice.

## Slice 2B: Configuración de meseros (10)

- [ ] 2B.1 `dominio.models.ts`: `ModoMeseros`, `RangoMeseros` (`id, desde, hasta: number|null, meseros`), `ConfigMeseros`, `ErrorRango`; `Evento.personas?` (si el código en curso no lo agregó). AC: coincide con D19.
- [ ] 2B.2 RED+GREEN `core/logica/config-meseros.ts` `validarRangos` (+spec): superposición (bordes inclusivos), `desde > hasta`, no enteros, `<= 0`, dos abiertos, abierto que no es el último, lista vacía válida.
- [ ] 2B.3 RED+GREEN `sugerirMeseros` (+spec): libre → null, sin config → null, sin personas / 0 / decimal → null, bordes `desde` y `hasta`, abierto, hueco → null. (Solo alimenta el aviso de la sección Cargos; no activa ni copia nada.)
- [ ] 2B.4 RED+GREEN `config-meseros.service.ts` (+spec): `obtener` (null si no existe), `guardar` (corre `validarRangos`, lanza con errores, un `patchRaiz` con el nodo completo + `actualizadoPor/En`; rangos con pushId). AC: `Updates` exacto.
- [ ] 2B.5 `database.rules.json` S2B: `config` (`.read` `JEFE_O_ADMIN`), `config/meseroRangos` (`.write` `ADMIN`, validaciones de D19). AC: coincide con el design.
- [ ] 2B.6 Checklist: admin escribe 200, jefe lee 200 y escribe 403, mesero lee 403, V10 (decimal rechazado), `hasta < desde` rechazado. AC: todas pasan.
- [ ] 2B.7 [ASK] Deploy de reglas (backup + aprobación).
- [ ] 2B.8 UI `page/admin/configuracion/`: `ConfiguracionComponent` (container) + `RangosMeserosComponent` (presentacional): `SegmentedControl` "Por cantidad de personas / Libre", intervalos con agregar/editar/borrar ("Hasta" vacío = "o más"), errores en línea, "Guardar". AC: modo libre conserva los intervalos.
- [ ] 2B.9 `app.routes.ts` + `nav-items.ts`: `/app/admin/configuracion` con `rolGuard('administrador')`; ítem "Configuración" solo en el menú del admin. AC: jefe redirigido.
- [ ] 2B.10 Smoke test manual + [ASK] commit del slice.

## Slice 3: Detalle del evento + equipo del evento + auditoría (16)

- [ ] 3.1 `dominio.models.ts`: `Evento` nuevo (`fechaInicio/fechaFin`, `inicioTs/finTs`, `personas?`, `reabierto*?`, `archivado*?`; sin `invitadosTodos`, Rev. 5), `MiembroEquipo` (`nombre, registrado`; `cargoInvitadosId?` llega en 4.1), `EntradaAuditoria`, `NuevaEntradaAuditoria`, `EventoDetalle`, `SeccionEvento`, `EstadoEvento` (derivado, no se guarda); borrar `fecha/horaInicio/horaFin/desmontajeAsignadoA` y el `estado` guardado. AC: coincide con el esquema.
- [ ] 3.2 RED+GREEN `PatchBuilder.audit(eid, e)` y `core/logica/auditoria.ts` `crearEntradaAuditoria` (+specs): path `auditoria/{eid}/{id}`, `ts = {'.sv':'timestamp'}`, quita undefined.
- [ ] 3.3 RED+GREEN `core/logica/ciclo-evento.ts` (+spec, con fechas fijas): `calcularInstantes(fecha, horaInicio, horaFin)` (si `horaFin <= horaInicio` el fin cae al día siguiente: 22:00→03:00; también cambio de mes y de año; horas iguales = día siguiente), `estadoEvento(info, ahora)` → `programado | en_curso | marcado_cerrado | finalizado | reabierto`, `puedeMarcarMesero` (inicio ≤ ahora ≤ fin + 2 h), `puedeEditar` (ahora ≤ fin + 4 h o `reabierto`), constantes `HORAS_CIERRE_MESERO = 2` y `HORAS_FINALIZADO = 4`. AC: bordes inclusivos testeados.
- [ ] 3.4 RED+GREEN `core/logica/cruce-horarios.ts` (+spec): `hayCruce(a, b)` (fin == inicio no cruza), `eventosEnConflicto(info, otros)`. [Q13]
- [ ] 3.5 RED+GREEN `core/logica/permisos.ts` (+spec): `esJefeOAdmin`, `seccionesVisibles(sesion, detalle)` según la tabla del spec `eventos-equipo` (sin sección de inventario).
- [ ] 3.6 RED+GREEN `audit.service.ts` (+spec): `listar(eid)` ordenado por clave.
- [ ] 3.7 RED+GREEN `event.service.ts` reescrito (+spec): `listarTodos` (shallow + forkJoin; excluye archivados salvo pedido), `listarMios` (membresías, ordenados por `inicioTs`), `obtenerInfo`, `obtenerDetalle`, `crear` (calcula instantes; con `personas`), `editar` (hojas, D12; recalcula instantes; rechaza si deja a un miembro en cruce), `borrar` básico (D17). Cada uno un `patchRaiz` con auditoría. AC: `Updates` exacto.
- [ ] 3.8 RED+GREEN `equipo.service.ts` (+spec): `agregarRegistrado` (rechaza si el usuario ya está en otro evento que se cruza [Q13]), `agregarNoRegistrado`, `quitar` (anula equipo y membresía; los `titularId` se suman en 4.4 porque los cargos llegan en el slice 4). Sin `cambiarVerInvitados` (Rev. 5). AC: `Updates` exacto.
- [ ] 3.9 `database.rules.json` S3: `eventos` (`.read` `JEFE_O_ADMIN`; `$eid .read` `ACTIVO && MIEMBRO`), `info` con validaciones (`personas`, `finTs > inicioTs`, fechas), `equipo` (registrado activo y no admin; sin `portero`/`verInvitados`), `membresias`, `auditoria` (append-only; jefe/admin; `CREANDO` para `evento.crear`); sin `EDITABLE` todavía (llega en 3B.2); legacy `participantes` y `tareas` se mantienen hasta 4.6. AC: coincide con el design.
- [ ] 3.10 Checklist: matriz de eventos/membresías/auditoría, V3, V4, V5, V6, V9. AC: todas pasan.
- [ ] 3.11 [ASK] Borrar los 2 eventos de prueba ("evento 1", "evento 2 xv": forma vieja de fechas) antes del deploy.
- [ ] 3.12 [ASK] Deploy de reglas (backup + aprobación). Si hay eventos reales, sale junto con 2, 3B y 4.
- [ ] 3.13 UI `page/eventos`: formulario con fecha + hora de inicio + hora de fin (el fin cruza medianoche) y `personas`; lista por rol (jefe/admin todos; mesero `listarMios` por fecha, **el de hoy primero y destacado; si hoy tiene uno solo, se abre directo**; sin eventos: "No tienes eventos ni cargos asignados"); "Ingresar" navega a `/app/eventos/:eid`. AC: el mesero solo ve sus eventos.
- [ ] 3.14 UI `page/eventos/detalle/`: `EventoDetalleComponent` (container, carga `obtenerDetalle`, barra de secciones con `seccionesVisibles`) + rutas hijas en `app.routes.ts`; default admin/jefe → `equipo`, mesero → `tareas`. AC: sección prohibida por URL redirige.
- [ ] 3.15 UI `EquipoEventoComponent`: selector de `listarElegibles` (cualquier rol activo), "Agregar sin cuenta", badge "Sin cuenta" y marca "Inactivo" si el miembro fue inactivado, quitar con confirmación; avisa del cruce de horarios. AC: inactivos no aparecen para agregar.
- [ ] 3.16 Smoke test manual en mobile + [ASK] commit del slice.

## Slice 3B: Ciclo de vida por tiempo + archivar/borrar (7)

- [ ] 3B.1 RED+GREEN `ciclo-evento.ts` (+spec): `puedeBorrar(info, tieneActividad, ahora)` (futuro o pasado sin actividad), `puedeArchivar` (admin, pasado con actividad). RED+GREEN `event.service.ts`: `reactivar` (solo admin: `reabierto=true`, `reabiertoPor/En`, `evento.reactivar`), `finalizar` (cierra el reabierto: quita `reabierto`, `evento.finalizar`) [Q14], `archivar`/`desarchivar` (solo admin, `evento.archivar|desarchivar`), `borrar` rechaza un pasado con datos (lee `actividad`). AC: `Updates` exacto.
- [ ] 3B.2 `database.rules.json` S3B: helpers de tiempo (`VENTANA_MESERO`, `EDITABLE`, `CREANDO`, `CON_DATOS_PASADO`) leyendo `root` `info/inicioTs`/`finTs`; `info` concedida por hojas: obligatorias con `newData.exists()` y `(CREANDO || EDITABLE)`, fechas además `!CON_DATOS_PASADO`, `personas` borrable; `EDITABLE` en `equipo`, `membresias` y `auditoria` (fuera de ella, solo ADMIN agrega); hojas `reabierto*` y `archivado*` solo ADMIN (reabrir sin exigir `editable`); `eventos/$eid .write = ADMIN && !newData.exists() && (!data.child('actividad').exists() || now <= data.child('info/finTs').val())`. AC: coincide con el design.
- [ ] 3B.3 Checklist: V11 (`now` contra `finTs` por hoja, también al crear: jefe crea evento + `evento.crear` 200), V12 (borrado condicional por `actividad`; con `actividad` sembrada a mano), V16 (sin `finTs` niega); admin borra `info/finTs` suelto 403; admin cambia fechas de un pasado con `actividad` 403; evento finalizado: jefe 403 en `info`/`equipo`; admin reabre 200, jefe reabre 403; reabierto: jefe edita 200; archivar jefe 403; borrar pasado con actividad 403, sin actividad 200. AC: todas pasan.
- [ ] 3B.4 [ASK] Deploy de reglas (backup + aprobación).
- [ ] 3B.5 UI: etiqueta de estado derivado en card y detalle (Programado, En curso, Marcado cerrado, Finalizado, "Reabierto"); botón "Reactivar" (solo admin, finalizado), "Finalizar" (admin, reabierto), "Archivar" (admin); "Borrar" oculto con el aviso "Este evento ya pasó y tiene datos: solo se puede archivar"; la lista principal oculta los archivados y ofrece "Ver archivados". AC: jefe no ve Reactivar/Archivar/Borrar.
- [ ] 3B.6 Auditoría visible: quién y cuándo reactivó (se muestra junto a "Reabierto"). AC: lee `reabiertoPor/En` de `info`.
- [ ] 3B.7 Smoke test manual (evento que cruza medianoche, reactivar, archivar, borrar) + [ASK] commit del slice.

## Slice 4: Cargos del evento (copia del catálogo) + tareas + vista del mesero (17) — reescrito en Rev. 6

- [ ] 4.1 `dominio.models.ts`: crear `Cargo` (`nombre, orden, manejaInvitados, titularId?, origenCatalogoId?`; sin `tipo`), `MiembroEquipo.cargoInvitadosId?`, `Tarea` nueva (`cargoId, origenCatalogoId?, auditId?`), `TareaSinResponsable`, `ResumenCopia`, `CargoOcupadoError`, `CargoConTareasHechasError`; `EventoDetalle.cargosCopiadosEn?`; borrar `Participante`, `TipoTarea` y los campos viejos de `Tarea`.
- [ ] 4.2 RED+GREEN `permisos.ts` (+spec): `puedeMarcar(sesion, cargo, info, ahora)` (mesero titular dentro de la ventana; admin/jefe si `puedeEditar`), `punteroLista(cargos, mid)` (D24). RED+GREEN `core/logica/cargos-sin-responsable.ts` (+spec): `tareasSinResponsable(cargos, tareas, equipo, usuarios)` (cargo sin titular, titular quitado o inactivo, tareas huérfanas); sin vista derivada del catálogo.
- [ ] 4.3 RED+GREEN `core/logica/copia-catalogo.ts` (+spec, D28): `construirCopiaCatalogo(pb, eid, catalogo, idGen)`: todos los cargos (sin titular, con `origenCatalogoId` y `manejaInvitados`) y todas sus tareas planas (ids nuevos, `estado = pendiente`, `cargoId` nuevo), marca `cargosCopiadosEn = {'.sv':'timestamp'}`; catálogo vacío → solo la marca; sin referencias compartidas con el catálogo.
- [ ] 4.4 RED+GREEN `core/logica/cargos-evento.ts` (+spec, D29–D31): `asignarTitular` (`titularId` + `ocupacion/{cid} = mid` + puntero; lanza `CargoOcupadoError` si ya tiene titular), `quitarTitular` (ambos a null + puntero), `construirCargoNuevo` (sin `origenCatalogoId`, `orden` max+1, tareas propias), `construirEliminarCargo` (lanza `CargoConTareasHechasError` si alguna tarea está `hecho`; borra cargo, tareas pendientes, `ocupacion` y puntero), `construirMoverTarea` (solo `tareas/{tid}/cargoId`; conserva `estado` y `auditId`; el destino debe existir).
- [ ] 4.5 RED+GREEN `cargo.service.ts` (+spec): `copiarCatalogoSiFalta(eid, info)` (solo admin/jefe y `puedeEditar`; un PATCH + `cargos.copiar_catalogo`; ante 403 relee y no reintenta), `asignar`, `quitarTitular`, `cambiarTitular` (= quitar + asignar, dos PATCHes auditados), `crear` (`cargo.crear`), `editar` (nombre y `manejaInvitados` [Q22], recalcula el puntero), `eliminar` (`cargo.eliminar` con los títulos borrados). Extender `EquipoService.quitar` para borrar `titularId` y `ocupacion/{cid}` de los cargos del miembro. AC: ningún `Updates` contiene paths bajo `catalogo/`.
- [ ] 4.6 RED+GREEN `task.service.ts` re-creado (+spec): `crear/editar/eliminar`, `mover` (D30: solo `cargoId` + `tarea.mover` con `{desde, hacia, estado}`) y `marcar` (un PATCH: `estado`, `auditId = aid`, `actividad = true` siempre, entrada `tarea.marcar` con `objetivo = tid` y `paraMid` si actor ≠ titular), todos auditados. Sin `cubrir`.
- [ ] 4.7 `database.rules.json` S4: `cargosCopiadosEn` (una sola vez, `=== now`, D28); `cargos` (`origenCatalogoId` opcional, `manejaInvitados` bool, sin `tipo`, `$other: false`); `cargos/$cid/titularId` (en el equipo y `=== ocupacion/{cid}` del post-estado); `ocupacion/$cid` LOCAL (ocupar solo si está libre; liberar solo junto con `titularId` o el cargo, D29); `tareas` (con `editable`; `cargoId` existe en el post-estado, D30); `actividad`; `tareas/$tid/estado` y `auditId` (mesero titular en `ventanaMesero` con acople; jefe/admin con `editable`); acople en `auditoria/$eid/$aid` para `tarea.marcar` del mesero; `equipo/$mid/cargoInvitadosId`; quitar `participantes` y la regla legacy de `tareas`. AC: coincide con el design.
- [ ] 4.8 Checklist: titular marca dentro de la ventana 200; antes del inicio y después de fin + 2 h 403; evento finalizado 403 para todos; otro cargo o campo 403; mesero borra `estado` 403 (V17); puntero faltante niega (V2, V4); V14 (asignar libre 200, ocupado 403, liberar `ocupacion` sin `titularId` 403); V21 (segunda copia 403 entera); V22 (mover a cargo existente 200, inexistente 403, mesero 403); titular fuera del equipo rechazado; marcado sin auditoría o auditoría sin marcado 403 (V15, V1); `actividad` borrada o en `false` 403; `cargoInvitadosId` hacia un cargo sin permiso o de otro titular 403 (V19). AC: todas pasan.
- [ ] 4.9 [ASK] Deploy de reglas (backup + aprobación).
- [ ] 4.10 UI copia al ingresar: `EventoDetalleComponent` llama a `copiarCatalogoSiFalta` antes de cargar las secciones (indicador "Preparando cargos…"; si el evento está finalizado sin copia, no copia y muestra "Este evento no tiene cargos"). AC: entrar dos veces no duplica; el mesero nunca dispara la copia.
- [ ] 4.11 UI sección `cargos` (`CargosEventoComponent` + presentacional por cargo): cargos del evento con titular o "Sin titular" y sus tareas; aviso con `sugerirMeseros(config, info.personas)` (compara con cargos con titular); "+ Cargo" (nombre sugerido `Mesero N`, permiso de lista, tareas iniciales); renombrar y permiso de lista; eliminar con confirmación ("Se borrarán N tareas pendientes; muévelas antes si las quieres conservar"), bloqueado si hay tareas hechas. Nota fija "Solo cambia en este evento". AC: el catálogo no cambia.
- [ ] 4.12 UI "Mover a…" (desbaratar): en cada tarea (sección `cargos` y bloque "Sin responsable"), selector de cargo destino del mismo evento; una tarea hecha se mueve conservando su check. AC: la tarea desaparece del origen y aparece en el destino con el mismo id.
- [ ] 4.13 UI sección `asignacion` (`AsignacionComponent`): por persona del equipo, un select de cargos del evento; uno ocupado aparece deshabilitado con "Ya está tomado por {nombre}"; cambiar de titular desde el cargo; avisa si el titular quedó inactivo; ante 403 por carrera, relee y avisa. AC: inactivos no elegibles; un cargo, una persona.
- [ ] 4.14 UI sección `tareas` para admin/jefe: vista en vivo de hechas y pendientes, bloque "Sin responsable" con "Mover a…" o asignar titular, checkbox = marcado delegado ("Marcado por {actor} para {titular}"). AC: nada escribe en el catálogo.
- [ ] 4.15 UI `MisTareasComponent` (mesero): solo las tareas de su cargo; antes del inicio "Podrás marcar tareas desde las {hora}" (solo lectura); después de fin + 2 h o finalizado, solo lectura; sin cargo: "Todavía no tienes un cargo en este evento". AC: escenarios de filtro y de ventana.
- [ ] 4.16 Borrar `page/tareas/asignar/*` y su ruta, el `task.service.ts` viejo (`calcularCarga`, `CargaMesero`, `asignar`), `event.service.ts` `listarParticipantes`, `obtenerVigente`, `generarId`; `ICONO_TAREAS` si quedó sin uso. AC: Grep sin referencias.
- [ ] 4.17 Smoke test manual en mobile (primer ingreso copia y el segundo no; crear "Mesero 6" y mover "Lavar champaña" desde `Mesero 1`; eliminar un cargo sobrante; mesero marca dentro y fuera de la ventana; jefe delega; dos teléfonos asignan el mismo cargo a la vez) + [ASK] commit del slice.

## Slice 5: Lista de invitados (15) — reescrito en Rev. 5

- [ ] 5.1 `dominio.models.ts`: `MetaInvitados`, `Invitado` (`gid, nombre, nombreNorm, mesa: string|null, orden, asistio, asistioPor?, asistioEn?, auditId?, removido?`), `InvitadoParseado`, `ResultadoParseo` (`invitados, porMesa, avisos, errores`), `AvisoParseo`, `ResumenFusion`, `ArchivoInvalidoError`; constantes `MAX_INVITADOS = 500`, `MAX_BYTES_XLSX = 1_048_576`, `MAX_LARGO_NOMBRE = 120`. AC: coincide con D9 y el spec.
- [ ] 5.2 RED+GREEN `core/logica/normalizar.ts` (+spec): `normalizarNombre` (trim, espacios simples), `claveNombre` (además sin tildes y en minúsculas: "  José   Pérez " → "jose perez"), `normalizarMesa` ("MESA 5 " → "MESA 5"), `esTituloMesa` (empieza con "MESA" sin importar mayúsculas ni tildes).
- [ ] 5.3 RED+GREEN `core/logica/parser-invitados.ts` (+spec, D25): fixture que reproduce el archivo real (columna A, `MESA PRINCIPAL` + `MESA 1..10`, ~107 nombres, `MESA 5 ` con espacio final, `MESA 7` pegada al grupo anterior, 0 a 3 filas vacías); lista sin títulos (todos con mesa null); nombres antes del primer título (sin mesa); encabezados `nombre`/`mesa`; duplicados (se conservan con aviso); celdas no-texto (aviso con fila); mesa vacía (aviso); nombre > 120 (aviso); datos fuera de la columna A u otras hojas (aviso); hoja vacía y > 500 (error). AC: `porMesa` en orden de aparición, "Sin mesa" al final.
- [ ] 5.4 RED+GREEN `core/logica/fusion-invitados.ts` (+spec, D26): pareja por nombre+mesa (repetidos en orden), por nombre único si cambió la mesa, homónimos no únicos no se emparejan, nuevo con `asistio = false`, desaparecido marcado → `removido = true` [Q20], desaparecido sin marca → `null`, un `removido` que reaparece se reactiva; los `updates` de un emparejado solo tocan `nombre`, `nombreNorm`, `mesa`, `orden`, `removido` (nunca las hojas de asistencia); sin rutas superpuestas (V6); `resumen` con conservados/nuevos/removidos/borrados.
- [ ] 5.5 RED+GREEN `core/logica/lista-invitados.ts` y `ventanas-invitados.ts` (+specs): `agruparPorMesa`, `contadores` (global y por mesa, sin `removido`), `filtrarPorNombre` (parcial, sin tildes ni mayúsculas: "maria jose pena" encuentra "María José Peña"); `puedeVerLista` / `puedeMarcarAsistencia` (admin siempre; jefe desde inicio − 1 h mientras `puedeEditar`; titular de lista con `punteroLista` desde inicio − 1 h hasta fin + 4 h, no en reabierto [Q21]). AC: bordes inclusivos con fechas fijas.
- [ ] 5.6 [ASK] `package.json`: agregar `read-excel-file` (y, solo si se hace 5.14, `write-excel-file`) (D10). AC: antes de pedir aprobación, verificar versión vigente, licencia MIT, compatibilidad con el build de Angular 18 y que no tenga advisories (`npm audit` lo corre el usuario); no correr `npm`.
- [ ] 5.7 RED+GREEN `core/logica/lector-xlsx.ts` (+spec): `leerPrimeraHoja(file)` con `import()` dinámico y `isPlatformBrowser`; rechaza extensión distinta de `.xlsx` y > 1 MiB antes de leer; devuelve filas de la primera hoja y nombres de las otras; cualquier excepción → `ArchivoInvalidoError` ("No pudimos leer el archivo. Verifica que sea un Excel (.xlsx)"). AC: spec con un .xlsx mínimo embebido y con bytes basura.
- [ ] 5.8 RED+GREEN `invitados.service.ts` (+spec): `obtenerMeta`, `listar`, `previsualizar(file, actuales?)` (no escribe), `subir` (un PATCH: `meta` + registros + `invitados.subir`), `reemplazar` (relee `lista`, `fusionarLista`, un PATCH + `invitados.reemplazar` con el resumen), `marcar(eid, invitado, asistio)` (un PATCH: `asistio`, `asistioPor`, `asistioEn` `{'.sv':'timestamp'}`, `auditId = aid`, entrada `invitado.asistencia`; **no** escribe `actividad` [Q19]), `borrar` (`invitados.borrar`). AC: `Updates` exacto; ningún path fuera de `invitados/E` y `auditoria/E`.
- [ ] 5.9 `database.rules.json` S5 `invitados` (D24): `.write` ADMIN en `$eid`; `meta` (`.read` jefe/admin/`TITULAR_LISTA`, validaciones); `lista` (`.read` con `DESDE_LISTA`/`EDITABLE`/`VENTANA_LISTA`); `lista/$gid` (campos y `$other: false`); hojas `asistio`, `asistioPor`, `asistioEn`, `auditId` (jefe y titular de lista en su ventana, solo registros existentes, acople para el titular); `auditoria/$eid/$aid` suma la rama `invitado.asistencia` del titular de lista con su acople. Se borran las reglas de `base64`. AC: coincide con el design.
- [ ] 5.10 Checklist: V7 (500 registros pasan entero; uno inválido rechaza todo), V13 (ventana: − 61 min 403, − 60 min 200, fin + 4 h 403, reabierto jefe 200 / titular 403, admin siempre 200), V18 (acople y campos prohibidos), V19 (puntero viejo o falso niega la lectura), V20 (PATCH de re-subida), trabajador sin permiso 403 en `meta` y `lista`, jefe y titular no crean ni borran registros. AC: todas pasan.
- [ ] 5.11 [ASK] Deploy de reglas (backup + aprobación).
- [ ] 5.12 UI `SubirListaComponent` (solo admin): elegir archivo, previsualización (total, conteo por mesa, avisos, resumen de la fusión si ya había lista), "Subir N invitados" / "Cancelar", errores claros (archivo inválido, vacío, demasiado grande, > 500). AC: cancelar no escribe; con errores no se puede confirmar.
- [ ] 5.13 UI `InvitadosComponent` (container) + `ListaInvitadosComponent`: "Por mesa / Todos", buscador sin tildes, checkbox de asistencia por invitado ("Marcado por {nombre} a las {hora}"), contadores global y por mesa, bloque "Llegaron pero ya no están en la lista", fuera de ventana "Podrás ver la lista desde las {hora}", sin lista "Todavía no se cargó la lista de invitados"; la sección aparece solo para admin, jefe y titulares de lista (`seccionesVisibles`). Refresco con la misma estrategia que la sección Tareas. AC: un trabajador sin permiso no ve la sección.
- [ ] 5.14 [OPCIONAL] "Exportar" la lista con asistencia a .xlsx en el navegador (`write-excel-file`). Se puede saltar sin afectar el resto.
- [ ] 5.15 Smoke test manual en mobile (subir el archivo real, buscar, marcar desde dos teléfonos a la vez, re-subir una versión corregida con marcas hechas) + [ASK] commit del slice.

## Slice 6: Visor de auditoría + cierre (6)

- [ ] 6.1 RED+GREEN `agruparPorPersona` en `auditoria.ts` (+spec).
- [ ] 6.2 UI sección `auditoria` (línea de tiempo + por persona), `rolGuard('jefe_mesero')`, solo lectura.
- [ ] 6.3 Quitar `RtdbService.put/remove` si quedaron sin uso, e íconos muertos.
- [ ] 6.4 Barrido final: Grep `asignadoA|desmontajeAsignadoA|Participante|participantes|calcularCarga|obtenerVigente|TipoTarea|confirmadoPorAdmin|/app/tareas|/app/inventario|generarId|listarActivosPorRol|activarme|crearPropio|activarSinTitular|cargo\.activar|cargoDesmontajeId|verInvitados|invitadosTodos|flagsPortero|base64DesdeDataUrl|ver_invitados|'portero'|apoyo|Apoyo|variasPersonas|esMultiTitular|tarea\.cubrir|construirAsignacion|TipoCargo` en `src/`. AC: cero resultados.
- [ ] 6.5 Pasada final del checklist con la matriz completa; revisión de los Success Criteria del proposal.
- [ ] 6.6 [ASK] Commit del slice.

## Pendiente / fuera del núcleo (no implementar, sin diseñar)

Desmontaje, montaje e inventario ocurren fuera del horario del evento y el usuario aún no sabe cómo manejarlos. Esto era el slice 5; se conserva el contenido para cuando se decida. Incluye el tipo de cargo `desmontaje` (no está en el catálogo del núcleo) y `info.cargoDesmontajeId`. Nada de esto entra en el conteo.

- [ ] P.1 [Q1] `dominio.models.ts`: `ItemInventario` nuevo, `EstadoInventario`, `ESTADOS_INVENTARIO` (default 3 valores).
- [ ] P.2 RED+GREEN `inventory.service.ts` re-creado (+spec): `listar`, `agregar`, `editar`, `archivar`, `snapshot`; auditados; [Q2] edición delegada con `paraMid`.
- [ ] P.3 [Q1][Q2][Q6] `database.rules.json` `inventario`: `.read` `ACTIVO`; `TITULAR_DESM`, regex de `estado`, evento no finalizado; `|| JEFE_O_ADMIN` solo si Q2 = sí y el titular es `nr_`.
- [ ] P.4 Checklist: titular 200; otro mesero, jefe no titular y sin puntero 403; estado inválido rechazado; evento finalizado 403. [ASK] deploy.
- [ ] P.5 RED+GREEN `guards/inventario.guard.ts` por `eid` (+spec): admin/jefe o titular de Desmontaje.
- [ ] P.6 UI sección `inventario`: cards `# | nombre | estado | notas` [Q1], solo lectura para admin/jefe no titulares.
- [ ] P.7 Tipo de cargo `desmontaje` en el catálogo y en el evento, `cargoDesmontajeId` y snapshot del inventario al finalizar.
- [ ] P.8 Smoke test manual + [ASK] commit.

## Resumen

| Slice | Tareas |
|---|---|
| Ya hecho | 7 (marcadas) |
| 0 Setup | 6 |
| 1 Usuarios + reglas base | 16 |
| 2 Catálogo "Cargos" | 14 |
| 2B Configuración de meseros | 10 |
| 3 Detalle + equipo del evento + auditoría | 16 |
| 3B Ciclo de vida + archivar/borrar | 7 |
| 4 Cargos del evento (copia) + tareas (Rev. 6) | 17 |
| 5 Lista de invitados (Rev. 5) | 15 (incluye 5.14 opcional) |
| 6 Auditoría + cierre | 6 |
| **Total pendiente** | **107** |
| Pospuesto (Desmontaje + inventario) | 8 (P.1–P.8, fuera del conteo) |
