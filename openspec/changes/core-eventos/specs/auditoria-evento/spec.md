# Auditoría por evento Specification

## Purpose

Log append-only por evento, con revisión por evento y por persona.

## Requirements

### Requirement: Entrada append-only

Toda entrada en `auditoria/{eid}/{pushId}` MUST tener `accion`, `actorUid`, `objetivo`, `detalle`, `ts` y opcional `paraMid`. Las reglas MUST exigir `!data.exists()`, `actorUid === auth.uid` y `ts === now`. Ninguna entrada MUST poder actualizarse ni borrarse. (ASSUMED, pending user confirmation, Q4) No hay auditoría global: los cambios de usuarios, del catálogo y de la configuración de meseros guardan solo `…Por/En` en su propio nodo.

#### Scenario: Crear
- GIVEN un usuario activo
- WHEN escribe una entrada con su uid y `ts` de servidor
- THEN se acepta

#### Scenario: Falsear actor
- GIVEN `actorUid` distinto del auth.uid
- WHEN escribe
- THEN recibe 403

#### Scenario: Ts falso
- GIVEN un `ts` fijo y no el del servidor
- WHEN escribe
- THEN recibe 403

#### Scenario: Editar o borrar
- GIVEN una entrada existente
- WHEN cualquier rol, admin incluido, la actualiza o borra
- THEN recibe 403

### Requirement: Acciones registradas

MUST registrarse, con `accion` de la forma `dominio.verbo`: CRUD, ciclo de vida y archivado de eventos (`evento.crear|editar|finalizar|reactivar|archivar|desarchivar|borrar`; `evento.reactivar` guarda quién y cuándo reabrió), alta y baja de miembros (`equipo.agregar|quitar`; `equipo.ver_invitados` se elimina en Rev. 5), (Rev. 6) la copia del catálogo al primer ingreso (`cargos.copiar_catalogo`, con el conteo de cargos y tareas), asignación de un titular (`cargo.titular`, con `paraMid`), quitar titular (`cargo.quitar_titular`), crear, renombrar/cambiar permiso y eliminar un cargo del evento (`cargo.crear|editar|eliminar`; `eliminar` lista los títulos de las tareas pendientes borradas), alta, edición, baja y movimiento de tareas entre cargos (`tarea.crear|editar|eliminar|mover`, `mover` con `detalle {desde, hacia, estado}`) y marcado de tareas (propio y delegado, `tarea.marcar`), subida, re-subida (con el resumen de la fusión) y borrado de la lista de invitados (`invitados.subir|reemplazar|borrar`; `invitados.todos` se elimina en Rev. 5) y cada marca o desmarca de asistencia (`invitado.asistencia`, `objetivo = gid`). `tarea.cubrir` y `cargo.activar` no existen (Rev. 6: ya no hay tareas derivadas del catálogo ni cargos por activar) y `inventario.*` queda pospuesto con el inventario. Cada acción MUST escribirse junto con su efecto en un único PATCH; para el marcado del mesero las reglas MUST exigir ese acople (ver `reglas-seguridad`). El mesero MUST poder agregar solo entradas `tarea.marcar` de su propio marcado, dentro de su ventana, y el titular de un cargo con `manejaInvitados` solo entradas `invitado.asistencia` acopladas a su marca, dentro de la ventana de la lista (ver `invitados-evento`). Una vez finalizado el evento, solo el admin MUST poder agregar entradas (por ejemplo `evento.reactivar`).

#### Scenario: Atomicidad
- GIVEN una asignación
- WHEN la entrada de auditoría es rechazada
- THEN la asignación tampoco se aplica

#### Scenario: Asignación auditada
- GIVEN un miembro sin cargo y `Mesero 2` libre en el evento
- WHEN el jefe se lo asigna
- THEN hay una sola entrada `cargo.titular` con `actorUid = jefe`, `objetivo = cid` y `paraMid`

#### Scenario: Reactivación auditada
- GIVEN un evento finalizado
- WHEN el admin lo reactiva
- THEN hay una entrada `evento.reactivar` con su `actorUid` y `ts`, aunque el evento esté finalizado

#### Scenario: Evento borrado
- GIVEN un evento con auditoría
- WHEN el admin lo borra
- THEN `auditoria/{eid}` se conserva con la entrada `evento.borrar`

### Requirement: Lectura y revisión

Solo admin y jefe MUST leer la auditoría, en la sección "Auditoría" del detalle del evento (solo lectura, línea de tiempo y vista por persona). El admin MUST poder revisar un evento y ver por persona sus cargos, quién se los asignó y qué marcó. Las entradas de usuarios inactivos MUST seguir visibles.

#### Scenario: Mesero lee
- GIVEN un mesero
- WHEN lee `auditoria/{eid}`
- THEN recibe 403

#### Scenario: Vista por persona
- GIVEN un miembro con cargos y marcados
- WHEN el admin filtra por esa persona
- THEN ve cargos, asignador y marcados
