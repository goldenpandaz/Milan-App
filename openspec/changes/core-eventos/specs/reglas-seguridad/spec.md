# Reglas de seguridad Specification

## Purpose

Helpers transversales y matriz de acceso en `database.rules.json`. Verificable con el emulador de RTDB y un checklist REST por rol.

## Requirements

### Requirement: Helpers y sin lectura raíz

Las reglas MUST definir (inline) `activo`, `esAdmin`, `esJefeOAdmin` y `esMiembro(eid)`, y MUST NOT tener `.read` en la raíz. Un usuario con `estado = inactivo` MUST ser negado en todo nodo salvo la lectura de su propio perfil.

#### Scenario: Lectura raíz
- GIVEN cualquier usuario autenticado
- WHEN hace GET a `/`
- THEN recibe 403

#### Scenario: Inactivo admin
- GIVEN un admin inactivo
- WHEN escribe cualquier nodo
- THEN recibe 403

### Requirement: Matriz de acceso

| Nodo | Admin | Jefe | Miembro/Mesero | Titular |
|---|---|---|---|---|
| `usuarios` r (lista) | sí | sí | no | no |
| `usuarios/{uid}` r | sí | sí | propio | propio |
| `usuarios` w rol/estado | sí (no el propio) | no | no | no |
| `catalogo` r/w | sí | sí | no | no |
| `config/meseroRangos` r | sí | sí | no | no |
| `config/meseroRangos` w | sí | no | no | no |
| `eventos` r (lista, shallow) | sí | sí | no | no |
| `eventos/{eid}` r | sí | sí | si miembro | si miembro |
| `eventos/{eid}` borrar | sí, salvo pasado con `actividad` (ese solo se archiva) | no | no | no |
| `eventos/{eid}/info/reabierto*`, `archivado*` w | sí | no | no | no |
| `eventos/{eid}` w (info sin borrar, equipo, cargos, tareas, ocupacion) | sí, mientras `EDITABLE` (fin + 4 h o reabierto) | sí, mientras `EDITABLE` | no | solo `tareas/.../estado` y `auditId` de su cargo, dentro de la ventana (inicio a fin + 2 h), acoplado a su entrada de auditoría |
| `eventos/{eid}/ocupacion/{ccid}` w | crear una vez; borrar solo con su cargo | idem | no | no |
| `eventos/{eid}/actividad` w (solo `true`, nunca borrar salvo con el evento) | sí, mientras `EDITABLE` | sí, mientras `EDITABLE` | no | sí, dentro de la ventana |
| `membresias/{uid}` r | propio | propio | propio | propio |
| `membresias` w | sí | sí | no | no |
| `inventario` (POSPUESTO) | — | — | — | — |
| `invitados/{eid}` w (meta, crear/borrar/renombrar registros, re-subida) | sí, siempre | no | no | no |
| `invitados/{eid}/meta` r | sí | sí | no | titular de lista (cargo con `manejaInvitados`), sin ventana |
| `invitados/{eid}/lista` r | siempre | desde inicio − 1 h mientras `EDITABLE` | no | titular de lista: desde inicio − 1 h hasta fin + 4 h (no en reabierto) |
| `invitados/{eid}/lista/{gid}/{asistio,asistioPor,asistioEn,auditId}` w | siempre | misma ventana que su lectura | no | misma ventana que su lectura, acoplado a su entrada `invitado.asistencia` |
| `eventos/{eid}/equipo/{mid}/cargoInvitadosId` w | sí, mientras `EDITABLE` | sí, mientras `EDITABLE` | no | no (debe apuntar a un cargo con permiso del que `mid` es titular) |
| `auditoria/{eid}` r | sí | sí | no | no |
| `auditoria/{eid}` create | sí (también finalizado) | sí (mientras `EDITABLE`, o al crear el evento) | no | solo `tarea.marcar` propia, acoplada a su marcado, dentro de la ventana; el titular de lista, además, `invitado.asistencia` acoplada a su marca, dentro de la ventana de la lista |
| `auditoria` update/delete | no | no | no | no |

#### Scenario: Mesero no miembro
- GIVEN un mesero que no está en `equipo` del evento B
- WHEN lee `eventos/B` o `invitados/B`
- THEN recibe 403 en cada uno

#### Scenario: Mesero y nivel general
- GIVEN un mesero activo
- WHEN lee `catalogo`, `config/meseroRangos` o `usuarios`
- THEN recibe 403 en cada uno

#### Scenario: Jefe y configuración
- GIVEN un jefe
- WHEN escribe `config/meseroRangos`
- THEN recibe 403

#### Scenario: Marcar tarea
- GIVEN un titular del cargo X
- WHEN cambia `estado` de una tarea con `cargoId = X`
- THEN se acepta
- AND con otro `cargoId` o campo distinto recibe 403

#### Scenario: Lista por cargo
- GIVEN un trabajador cuyo `cargoInvitadosId` apunta a un cargo que ya no tiene el permiso o del que ya no es titular
- WHEN lee `invitados/{eid}/lista`
- THEN recibe 403 (la regla re-verifica el cargo apuntado; un puntero viejo no abre)

#### Scenario: Snapshot con origen
- GIVEN un jefe
- WHEN escribe en un PATCH el cargo y las tareas del evento con `origenCatalogoId`, `ocupacion` y la entrada de auditoría
- THEN se acepta aunque `origenCatalogoId` no exista en el catálogo (solo trazabilidad)

### Requirement: Tiempo en las reglas

Las reglas MUST usar `now` y `info/inicioTs`/`finTs` para: (a) permitir el marcado del mesero solo entre el inicio y fin + 2 h; (b) bloquear toda escritura de `info`, `equipo`, `cargos`, `tareas`, `ocupacion` y `membresias` pasadas fin + 4 h salvo `info/reabierto` (equivale a inmutable); (c) permitir `info/reabierto*` y `info/archivado*` solo al admin; (d) impedir borrar un evento pasado con `actividad`; (e) abrir la lista de invitados y su marcado de asistencia solo en la ventana de la lista (desde inicio − 1 h; jefe mientras `EDITABLE`, titular de lista hasta fin + 4 h), independiente de la ventana de marcado de tareas. La creación del evento MUST poder escribir `info` aunque aún no exista `finTs`.

#### Scenario: Marcado fuera de ventana
- GIVEN un mesero titular y `now` antes de `inicioTs`
- WHEN cambia `estado` de su tarea
- THEN recibe 403

#### Scenario: Evento finalizado
- GIVEN `now > finTs + 4 h` y sin `reabierto`
- WHEN el jefe o el admin escriben `cargos` o `tareas`
- THEN reciben 403

#### Scenario: Reabierto
- GIVEN un evento finalizado que el admin reactivó
- WHEN el jefe edita `tareas`
- THEN se acepta, y el mesero sigue recibiendo 403 al marcar

#### Scenario: Cargo numerado duplicado
- GIVEN `ocupacion/{ccid}` ya existe
- WHEN otro PATCH escribe `ocupacion/{ccid}` (segundo snapshot del mismo cargo)
- THEN recibe 403 entero

#### Scenario: Desfijar actividad
- GIVEN un evento con `actividad = true`
- WHEN cualquier rol, admin incluido, borra o pone en `false` solo `actividad`
- THEN recibe 403

#### Scenario: Creación del evento por el jefe
- GIVEN un evento que aún no existe
- WHEN el jefe escribe en un PATCH las hojas de `info` y la entrada `evento.crear`
- THEN se acepta aunque todavía no haya `finTs` guardado

### Requirement: Escritura multi-path

Una acción con su auditoría MUST aceptarse o rechazarse completa en un PATCH a la raíz. Para el marcado del mesero y la marca de asistencia del titular de lista (los únicos roles no confiables que escriben) las reglas MUST exigir el acople: la tarea o el invitado apuntan (`auditId`) a una entrada nueva `tarea.marcar` / `invitado.asistencia` del mismo PATCH y esa entrada apunta a ellos. Para admin y jefe el acople lo garantiza el cliente (riesgo aceptado).

#### Scenario: Una hoja inválida
- GIVEN un PATCH con una hoja que viola una regla
- WHEN se envía
- THEN no se aplica ninguna hoja

#### Scenario: Auditoría falsa del mesero
- GIVEN un mesero miembro
- WHEN escribe una entrada `tarea.marcar` sin cambiar ninguna tarea, o una entrada con otra `accion`
- THEN recibe 403

### Requirement: Despliegue controlado

Antes de cada deploy de reglas MUST guardarse un backup de las reglas vivas (las de la consola, no el archivo local, que puede tener ediciones sin desplegar) y MUST pedirse aprobación explícita al usuario.

#### Scenario: Deploy sin aprobación
- GIVEN reglas nuevas listas y verificadas en el emulador
- WHEN no hay aprobación explícita del usuario
- THEN no se despliegan

### Requirement: Verificación

Cada slice que cambie reglas MUST pasar la matriz en el emulador (checklist REST) antes del deploy. Comportamientos por confirmar (V1–V20 del design; Rev. 5 redefine V7 y V13 y agrega V18–V20 para la lista de invitados, ver también "Viabilidad de reglas"): `child(null)` sin puntero, validación por hoja en PATCH raíz, `ts === now` vía REST, `.validate` de ancestros, shallow, superposición de paths, strings largos, `actualizadoEn` del catálogo, borrado atómico del evento, enteros en `config`, `EDITABLE` por hoja y en la creación (V11), borrado condicional por `actividad` (V12), ventanas de invitados (V13), unicidad de `ocupacion` (V14), acople marcado ↔ auditoría (V15), aritmética con `null` (V16) y condiciones en `.write` frente a borrados (V17).

#### Scenario: Puntero faltante
- GIVEN una tarea cuyo `cargoId` apunta a un cargo inexistente
- WHEN el mesero intenta marcarla
- THEN deniega sin error de evaluación que abra el acceso

> Las reglas de `inventario` (y el puntero `cargoDesmontajeId`) quedan pospuestas con el inventario.
