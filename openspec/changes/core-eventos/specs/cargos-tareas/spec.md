# Cargos y tareas del evento Specification

## Purpose

Cargos POR EVENTO: el catálogo es plantilla y el evento guarda su propia copia (snapshot) de un cargo y sus tareas **al asignarlo a una persona**. Cubre la ocupación de cargos (numerados de una sola persona, `Apoyo` de varias), las tareas "sin responsable", el marcado propio y delegado dentro de la ventana de tiempo y la vista del mesero. Reemplaza las viejas pantallas "Tareas" y "Asignar" y la idea previa de copiar el catálogo entero al evento. No existen cargos creados solo para un evento (decisión del usuario). (Rev. 5) En este spec "mesero" como persona = usuario con rol `mesero`, que la UI muestra como **Trabajador**; `Mesero N` es un cargo.

## Requirements

### Requirement: Snapshot al asignar

Admin y jefe MUST poder asignar a una persona del equipo del evento un cargo del catálogo. Al asignarlo, el evento MUST crear en un único PATCH su propia copia: un cargo en `eventos/{eid}/cargos` (`nombre`, `tipo`, `orden`, `manejaInvitados`, `titularId`, `origenCatalogoId`) y sus tareas en `eventos/{eid}/tareas` (ids nuevos, `estado = pendiente`, `origenCatalogoId`), el índice `ocupacion/{ccid} = cid` (salvo `Apoyo`) y la entrada de auditoría `cargo.titular`. El catálogo completo MUST NOT copiarse al evento y MUST NOT crearse cargos por adelantado ni cargos propios del evento. Después del snapshot el evento MUST ser independiente del catálogo: editar o borrar el catálogo no cambia ningún evento existente ni pasado.

Si el cargo tiene `manejaInvitados = true`, el mismo PATCH MUST fijar `equipo/{mid}/cargoInvitadosId = cid` (puntero para las reglas de la lista de invitados, ver `invitados-evento`). Cambiar o quitar el titular, deshacer la asignación, sacar al miembro del equipo o cambiar `manejaInvitados` del cargo del evento MUST recalcular ese puntero en el mismo PATCH (apunta a otro cargo con permiso de esa persona, o se borra). Admin y jefe MAY cambiar `manejaInvitados` de un cargo del evento (solo ese evento, `cargo.editar`; ASSUMED, Rev. 5).

#### Scenario: Asignar un cargo
- GIVEN un catálogo con `Mesero 1` (2 tareas) y un miembro del equipo
- WHEN el jefe asigna `Mesero 1` a ese miembro
- THEN el evento tiene un cargo `Mesero 1` con `titularId` y 2 tareas propias pendientes con `origenCatalogoId`, `ocupacion/{ccid}` apunta a ese cargo y hay una entrada `cargo.titular` con `paraMid`

#### Scenario: Solo se copia lo asignado
- GIVEN un catálogo con 5 `Mesero` y un evento con 4 personas con cargo
- WHEN el jefe termina de asignar
- THEN el evento tiene 4 cargos guardados y no hay un `Mesero 5` guardado

#### Scenario: Independencia posterior
- GIVEN un evento donde ya se asignó `Portero`
- WHEN el admin cambia o borra `Portero` y sus tareas en el catálogo
- THEN el evento, también si ya pasó, no cambia

### Requirement: Un cargo numerado, una persona

Un cargo no `Apoyo` del catálogo (`Mesero N` o `libre`, p. ej. `Portero`) MUST tener a lo sumo un snapshot por evento y ese snapshot a lo sumo un titular (`titularId`). Si ya tiene titular, la app MUST avisar ("Ya está tomado por {nombre}") y MUST NOT dejar asignarlo. Las reglas MUST impedir un segundo snapshot del mismo cargo mediante `eventos/{eid}/ocupacion/{ccid}` (se escribe una sola vez y solo se borra junto con su cargo). Cambiar de titular MUST actualizar el `titularId` del mismo snapshot (conserva sus tareas y lo ya marcado). Un miembro MAY tener varios cargos distintos.

#### Scenario: Cargo ya tomado
- GIVEN `Mesero 3` asignado a Ana
- WHEN el jefe intenta asignar `Mesero 3` a Luis
- THEN la app avisa que ya está tomado y no escribe

#### Scenario: Doble snapshot por la REST
- GIVEN `ocupacion/{ccid}` ya existe
- WHEN un PATCH crea otro cargo con el mismo `origenCatalogoId` y reescribe `ocupacion/{ccid}`
- THEN recibe 403 y no se aplica nada

#### Scenario: Cambiar de titular
- GIVEN `Mesero 3` asignado a Ana, con una tarea ya hecha
- WHEN el jefe lo pasa a Luis
- THEN en un PATCH el mismo cargo queda con `titularId = Luis`, la tarea hecha sigue hecha y hay una entrada `cargo.titular`
- AND si el cargo tiene `manejaInvitados`, el puntero `cargoInvitadosId` pasa de Ana a Luis en el mismo PATCH

#### Scenario: Reasignar un snapshot sin titular
- GIVEN `Mesero 3` con snapshot pero sin titular (se quitó a su titular)
- WHEN el jefe se lo asigna a Luis
- THEN se reutiliza ese snapshot (no se crea otro)

#### Scenario: Deshacer una asignación
- GIVEN un cargo asignado por error y sin tareas hechas
- WHEN el admin lo deshace
- THEN se borran el cargo, sus tareas y `ocupacion/{ccid}` en un PATCH, con `cargo.eliminar`; si alguna tarea está hecha la app no lo permite

### Requirement: Cargo Apoyo

El cargo genérico `Apoyo` del catálogo MUST poder asignarse a varias personas a la vez en el mismo evento. Cada asignación MUST crear su propio cargo del evento con su propia copia de las tareas genéricas (cada persona marca las suyas) y MUST NOT usar `ocupacion`. Si hay más personas que cargos, las que sobran MUST tomar `Apoyo`; la app MUST NOT inventar cargos como "Mesero 6".

#### Scenario: Siete personas, cinco cargos
- GIVEN un catálogo con `Mesero 1` a `Mesero 5` y `Apoyo`, y 7 meseros en el equipo
- WHEN el jefe asigna `Mesero 1..5` a cinco y `Apoyo` a los otros dos
- THEN el evento tiene 5 cargos numerados y 2 cargos `Apoyo`, cada uno con su titular y su copia de las tareas genéricas

### Requirement: Tareas sin responsable

Mientras el evento sea editable, las tareas "sin responsable" MUST ser: (a) las de un snapshot sin titular, con titular quitado del equipo o con titular inactivo; y (b) las de cada cargo del catálogo (no `Apoyo`) que no tiene snapshot en el evento, como **vista derivada sin escribir nada**, excluyendo las que ya se cubrieron (alguna tarea del evento tiene ese `origenCatalogoId`). Admin y jefe MUST poder reasignarlas solo dentro de ese evento: (a) moviéndolas a otro cargo del evento (`tarea.mover`); (b) copiándolas como tarea nueva de un cargo del evento (`tarea.cubrir`, con `origenCatalogoId`). Ninguna reasignación MUST modificar `catalogo` ni crear un cargo. Con el evento finalizado, la parte (b) MUST NOT mostrarse: el evento muestra solo lo que guardó. La cantidad de meseros sugerida por `configuracion-meseros` MUST ser solo un aviso que compara con la cantidad de personas con cargo `mesero`, sin cambiar nada.

#### Scenario: Cuatro de cinco
- GIVEN un catálogo con `Mesero 1..5`, la sugerencia de 5 y 4 personas con `Mesero 1..4`
- WHEN el jefe abre Tareas
- THEN ve "Para 150 personas se sugieren 5 meseros; tienes 4" y las tareas de `Mesero 5` en "Sin responsable", sin que exista ningún `Mesero 5` guardado en el evento

#### Scenario: Cubrir una tarea del catálogo
- GIVEN una tarea derivada "sin responsable" de `Mesero 5`
- WHEN el jefe la reasigna a `Mesero 2`
- THEN `Mesero 2` tiene una tarea nueva copiada (con `origenCatalogoId`), hay una entrada `tarea.cubrir`, la tarea deja de aparecer "sin responsable" y el catálogo no cambia

#### Scenario: Mover una tarea guardada
- GIVEN tareas "sin responsable" de un snapshot `Mesero 4` sin titular
- WHEN el jefe las mueve a `Mesero 2`
- THEN quedan con el `cargoId` de `Mesero 2` y hay entradas `tarea.mover`

#### Scenario: Mesero inactivado
- GIVEN un mesero titular de `Mesero 2` en un evento futuro
- WHEN el admin lo inactiva
- THEN sigue en el equipo del evento marcado como inactivo y las tareas de `Mesero 2` aparecen "sin responsable"

#### Scenario: Evento finalizado
- GIVEN un evento finalizado y un cargo del catálogo que nunca se asignó
- WHEN el admin abre Tareas
- THEN no aparecen tareas derivadas de ese cargo

### Requirement: Edición dentro del evento

Admin y jefe MAY renombrar un cargo del evento (`cargo.editar`) y crear, editar, borrar, mover y cubrir tareas del evento, siempre auditado y nunca escribiendo en `catalogo`. MUST NOT existir el alta de un cargo propio del evento. El jefe MAY ser titular de un cargo con sus propias tareas.

#### Scenario: Renombrar solo en el evento
- GIVEN un cargo `Portero` ya asignado
- WHEN el admin lo renombra a `Portero principal` en el evento
- THEN el catálogo sigue con `Portero` y hay una entrada `cargo.editar`

#### Scenario: Jefe titular
- GIVEN el jefe es miembro del equipo
- WHEN se asigna a sí mismo `Mesero 3`
- THEN queda como titular y ve sus tareas

#### Scenario: Asignar inactivo
- GIVEN un usuario inactivo
- WHEN se intenta asignar
- THEN no es elegible

#### Scenario: Titular fuera del equipo
- GIVEN un `mid` que no está en `equipo`
- WHEN se escribe como `titularId`
- THEN la escritura se rechaza

### Requirement: Tareas del evento

Cada tarea MUST pertenecer a un cargo del evento (`cargoId`) con `titulo`, `orden`, `estado` y opcional `origenCatalogoId`. Admin y jefe MUST crearlas, editarlas, moverlas y borrarlas, solo para ese evento y mientras el evento sea editable, con auditoría.

#### Scenario: Crear tarea
- GIVEN un cargo existente del evento
- WHEN el jefe crea una tarea
- THEN queda con `cargoId`, `estado` pendiente, sin `origenCatalogoId`, y hay una entrada `tarea.crear`

### Requirement: Marcado propio y ventana de tiempo

El titular de un cargo MUST poder marcar y desmarcar las tareas de ese cargo, cambiando solo `estado` (y el puntero `auditId` a su entrada de auditoría), **únicamente entre la hora de inicio del evento y fin + 2 horas** (ver `eventos-equipo`). Antes del inicio el mesero ve el evento y su cargo pero MUST NOT marcar; después de fin + 2 h el marcado de meseros MUST estar cerrado. Las reglas MUST hacer cumplir la ventana con `now`, no solo la UI. Cada marcado MUST escribir en el mismo PATCH su entrada `tarea.marcar` y `eventos/{eid}/actividad = true` (en todo marcado; no se puede desfijar). Las reglas MUST rechazar un marcado del mesero sin su entrada de auditoría y una entrada de marcado del mesero sin su marcado.

#### Scenario: Mesero marca dentro de la ventana
- GIVEN un mesero titular de `Mesero 1` y el evento en curso
- WHEN marca una tarea de `Mesero 1`
- THEN `estado` cambia, `actividad` es `true` y se registra `tarea.marcar`

#### Scenario: Marcado sin auditoría
- GIVEN un mesero titular dentro de la ventana
- WHEN cambia `estado` por la REST sin escribir la entrada de auditoría
- THEN recibe 403

#### Scenario: Antes del inicio
- GIVEN un evento que empieza a las 20:00 y son las 19:00
- WHEN el mesero intenta marcar su tarea
- THEN la UI lo muestra solo lectura ("Podrás marcar tareas desde las 20:00") y la REST responde 403

#### Scenario: Después de fin + 2 horas
- GIVEN un evento que terminó hace 2 h y 1 min
- WHEN el mesero intenta marcar
- THEN recibe 403

#### Scenario: Tarea de otro cargo
- GIVEN un mesero que no es titular del cargo
- WHEN intenta marcar esa tarea
- THEN recibe 403

#### Scenario: Cambio de otros campos
- GIVEN el titular
- WHEN modifica `titulo` o `cargoId`, o borra `estado`
- THEN recibe 403

### Requirement: Marcado delegado

Admin y jefe MUST poder marcar cualquier tarea del evento mientras sea editable (por ejemplo, de cargos con titular no registrado, sin titular o con titular inactivo); cuando el actor no es el titular, la auditoría MUST guardar `actorUid` y `paraMid`. Las tareas de un miembro "no registrado" las marcan admin y jefe.

#### Scenario: Delegado
- GIVEN un cargo con titular `nr_x`
- WHEN el jefe marca una tarea
- THEN la auditoría guarda `actorUid = jefe` y `paraMid = nr_x`, y la UI muestra "Marcado por {jefe} para {titular}"

### Requirement: Vista del mesero y seguimiento en vivo

La UI MUST mostrar al mesero solo sus eventos y, dentro del evento, solo las tareas de su cargo (filtro de UI; las reglas no ocultan otros cargos del mismo evento). Un mesero no tiene eventos que se crucen en horario, así que ve un solo evento a la vez. Admin y jefe MUST ver en vivo qué tareas se hicieron, cuáles faltan y cuáles quedan "sin responsable".

#### Scenario: Filtro
- GIVEN un evento con tareas de tres cargos y el mesero titular de uno
- WHEN abre la sección Tareas
- THEN ve solo las tareas de su cargo

#### Scenario: Sin cargo
- GIVEN un mesero miembro sin cargo asignado
- WHEN abre la sección Tareas
- THEN ve "Todavía no tienes un cargo en este evento"

#### Scenario: Seguimiento en vivo
- GIVEN un evento en curso
- WHEN el jefe abre Tareas
- THEN ve las hechas, las pendientes y el bloque "Sin responsable"
