# Cargos y tareas del evento Specification

## Purpose

(Rev. 6, reemplaza el modelo de "snapshot al asignar" y el cargo genérico `Apoyo`.) Cargos POR EVENTO: el catálogo general es solo plantilla; la primera vez que admin o jefe entran a un evento ("Ingresar"), el evento guarda una **copia completa** del catálogo (todos los cargos con sus tareas). Desde ahí la copia es del evento y se edita de forma aislada: renombrar, crear cargos nuevos solo de ese evento (p. ej. "Mesero 6"), eliminar cargos y mover tareas entre cargos ("desbaratar"). Cada cargo del evento tiene **un solo titular** (persona del equipo o "no registrado"); si hace falta más gente que cargos, se crean cargos nuevos en el evento. Cubre también las tareas "sin responsable", el marcado propio y delegado dentro de la ventana de tiempo y la vista del mesero. En este spec "mesero" como persona = usuario con rol `mesero` (la UI lo muestra como **Trabajador**); `Mesero N` es un cargo.

## Requirements

### Requirement: Copia del catálogo al ingresar

Cuando admin o jefe abren el detalle de un evento editable y el evento todavía no tiene copia (`eventos/{eid}/cargosCopiadosEn` no existe), la app MUST copiar en un único PATCH todo el catálogo tal como está en ese momento: por cada cargo del catálogo un `eventos/{eid}/cargos/{cid}` (`nombre`, `orden`, `manejaInvitados`, `origenCatalogoId`, sin titular) y por cada tarea un `eventos/{eid}/tareas/{tid}` (ids nuevos, `cargoId = cid`, `titulo`, `orden`, `estado = pendiente`, `origenCatalogoId`), más la marca `cargosCopiadosEn` (hora del servidor) y la entrada de auditoría `cargos.copiar_catalogo`. La marca MUST escribirse una sola vez: si dos personas entran a la vez, el segundo PATCH MUST rechazarse entero y la app MUST releer el evento. Un catálogo vacío MUST igual dejar la marca (el evento queda sin cargos y se crean a mano). El mesero MUST NOT disparar la copia (no lee el catálogo); si entra antes, ve "Todavía no tienes un cargo en este evento". Un evento finalizado sin copia MUST NOT copiar nada.

#### Scenario: Primer ingreso
- GIVEN un catálogo con `Portero` (2 tareas) y `Mesero 1..5` (3 tareas cada uno) y un evento sin copia
- WHEN el jefe toca "Ingresar"
- THEN el evento tiene 6 cargos sin titular y 17 tareas pendientes con `origenCatalogoId`, la marca `cargosCopiadosEn` y una entrada `cargos.copiar_catalogo`

#### Scenario: Segundo ingreso
- GIVEN un evento que ya tiene `cargosCopiadosEn`
- WHEN el admin vuelve a entrar
- THEN no se copia nada

#### Scenario: Dos ingresos a la vez
- GIVEN un evento sin copia
- WHEN admin y jefe entran al mismo tiempo
- THEN solo un PATCH se aplica, el otro recibe 403 y su app relee el evento ya copiado

### Requirement: Independencia de la copia

Una vez copiado, el evento MUST ser independiente del catálogo y de los demás eventos: editar o borrar el catálogo después MUST NOT cambiar ningún evento ya copiado (ni pasado ni futuro). Un evento que todavía no se copió MUST traer el catálogo vigente al momento de su primer ingreso. Ninguna edición dentro del evento MUST escribir bajo `catalogo/`.

#### Scenario: Catálogo editado después
- GIVEN un evento que ya copió `Portero`
- WHEN el admin renombra o borra `Portero` en el catálogo
- THEN el evento no cambia

#### Scenario: Evento futuro sin copia
- GIVEN un evento futuro al que nadie entró todavía
- WHEN el jefe agrega una tarea a `Mesero 1` en el catálogo y después entra al evento
- THEN el `Mesero 1` del evento ya trae la tarea nueva

### Requirement: Edición de cargos dentro del evento

Mientras el evento sea editable, admin y jefe MUST poder, solo en ese evento y siempre auditado: renombrar un cargo y cambiar su `manejaInvitados` (`cargo.editar`); crear un cargo nuevo con nombre libre (la UI sugiere el siguiente `Mesero N`), `manejaInvitados` opcional y sus propias tareas, sin `origenCatalogoId` (`cargo.crear`); y eliminar un cargo (`cargo.eliminar`, ver el requirement siguiente). Cambiar `manejaInvitados` o el titular MUST recalcular en el mismo PATCH el puntero `equipo/{mid}/cargoInvitadosId` del titular (ver `invitados-evento`).

#### Scenario: Crear Mesero 6
- GIVEN un evento con `Mesero 1..5` copiados y 6 meseros en el equipo
- WHEN el jefe crea "Mesero 6" con la tarea "Reponer hielo"
- THEN el evento tiene un cargo `Mesero 6` sin `origenCatalogoId` con su tarea, hay una entrada `cargo.crear` y el catálogo no cambia

#### Scenario: Renombrar solo en el evento
- GIVEN un cargo `Portero` copiado
- WHEN el admin lo renombra a `Portero principal`
- THEN el catálogo sigue con `Portero` y hay una entrada `cargo.editar`

#### Scenario: Permiso de lista en un cargo nuevo
- GIVEN un cargo `Recepción 2` creado en el evento
- WHEN el jefe le activa `manejaInvitados` y tiene titular Ana
- THEN `equipo/Ana/cargoInvitadosId` apunta a ese cargo en el mismo PATCH

### Requirement: Eliminar un cargo del evento

Admin y jefe MAY eliminar un cargo del evento solo si **ninguna de sus tareas está `hecho`**; si alguna lo está, la app MUST pedir que primero se muevan esas tareas a otro cargo. Al eliminar, el mismo PATCH MUST borrar el cargo, sus tareas pendientes (se pierden; la UI avisa "Se borrarán N tareas pendientes; muévelas antes si las quieres conservar"), su `ocupacion` y el puntero `cargoInvitadosId` del titular si apuntaba a él, con la entrada `cargo.eliminar` que lista los títulos borrados.

#### Scenario: Eliminar sin tareas hechas
- GIVEN `Mesero 5` con 3 tareas pendientes y sin titular
- WHEN el jefe lo elimina
- THEN desaparecen el cargo y sus 3 tareas en un PATCH y hay una entrada `cargo.eliminar` con los títulos

#### Scenario: Eliminar con tareas hechas
- GIVEN `Mesero 2` con una tarea `hecho`
- WHEN el admin intenta eliminarlo
- THEN la app no lo permite y le pide mover primero la tarea hecha

### Requirement: Mover tareas entre cargos ("desbaratar")

Mientras el evento sea editable, admin y jefe MUST poder mover una tarea de un cargo a otro del mismo evento. Mover MUST cambiar solo `cargoId` de la misma tarea (mismo `tid`, mismo `estado`, mismo `auditId`), nunca copiarla, y MUST escribir en el mismo PATCH la entrada `tarea.mover` con `detalle {desde, hacia}`. Una tarea `hecho` que se mueve MUST seguir `hecho` y su marcado previo sigue en la auditoría. El destino MUST existir en el evento.

#### Scenario: Mover a un cargo nuevo
- GIVEN `Mesero 1` con "Lavar champaña" y un `Mesero 6` recién creado
- WHEN el jefe mueve "Lavar champaña" a `Mesero 6`
- THEN la tarea tiene el mismo id y `cargoId = Mesero 6`, ya no aparece en `Mesero 1` y hay una entrada `tarea.mover`

#### Scenario: Mover una tarea hecha
- GIVEN una tarea `hecho` de `Mesero 3`
- WHEN el admin la mueve a `Mesero 4`
- THEN sigue `hecho`, conserva su `auditId` y hay una entrada `tarea.mover` con el actor y la hora

#### Scenario: Destino inexistente
- GIVEN un PATCH que pone en `cargoId` un cargo que no existe en el evento
- WHEN se envía
- THEN se rechaza

### Requirement: Un cargo, un titular

Cada cargo del evento (copiado o creado) MUST tener a lo sumo un titular (`titularId`, miembro del equipo, registrado o `nr_`). La unicidad es LOCAL al evento: `eventos/{eid}/ocupacion/{cid} = mid` se escribe en el mismo PATCH que `titularId`, solo si está libre, y se borra al quitar el titular. Asignar un cargo ocupado MUST avisar "Ya está tomado por {nombre}" y las reglas MUST rechazar el PATCH. **Cambiar de titular** = quitar al actual y asignar al nuevo (dos PATCHes, cada uno auditado: `cargo.quitar_titular` y `cargo.titular`); el cargo conserva sus tareas y lo ya marcado. Un miembro MAY tener varios cargos. NO existe un cargo compartido por varias personas: si faltan cargos, se crean en el evento.

#### Scenario: Asignar un cargo libre
- GIVEN `Mesero 1` copiado sin titular y Ana en el equipo
- WHEN el jefe se lo asigna a Ana
- THEN en un PATCH `titularId = Ana`, `ocupacion/{cid} = Ana` y hay una entrada `cargo.titular` con `paraMid`

#### Scenario: Cargo ya tomado
- GIVEN `Mesero 3` con titular Ana
- WHEN otro jefe, con la pantalla desactualizada, se lo asigna a Luis
- THEN el PATCH recibe 403 y la app avisa que ya está tomado

#### Scenario: Cambiar de titular
- GIVEN `Mesero 3` con titular Ana y una tarea hecha
- WHEN el jefe lo pasa a Luis
- THEN se quita a Ana y se asigna a Luis, la tarea hecha sigue hecha, hay entradas `cargo.quitar_titular` y `cargo.titular`, y el puntero `cargoInvitadosId` se recalcula si el cargo tiene `manejaInvitados`

#### Scenario: Siete personas, cinco cargos
- GIVEN `Mesero 1..5` copiados y 7 meseros en el equipo
- WHEN el jefe crea `Mesero 6` y `Mesero 7` en el evento y asigna los siete
- THEN cada cargo tiene un solo titular

#### Scenario: Titular fuera del equipo
- GIVEN un `mid` que no está en `equipo`
- WHEN se escribe como `titularId`
- THEN la escritura se rechaza

### Requirement: Tareas sin responsable

Mientras el evento sea editable, las tareas "sin responsable" MUST ser las de cualquier cargo del evento sin titular, con titular quitado del equipo o con titular inactivo. Admin y jefe MUST poder resolverlas asignando un titular al cargo o moviendo las tareas a otro cargo (`tarea.mover`). Ya no hay tareas "derivadas" del catálogo: todo lo que el evento muestra está guardado en el evento. La cantidad sugerida por `configuracion-meseros` MUST ser solo un aviso que compara con la cantidad de cargos del evento con titular, sin cambiar nada.

#### Scenario: Cuatro de cinco
- GIVEN `Mesero 1..5` copiados, la sugerencia de 5 y titulares solo en `Mesero 1..4`
- WHEN el jefe abre Tareas
- THEN ve las tareas de `Mesero 5` en "Sin responsable" y puede moverlas a otro cargo o asignarle titular

#### Scenario: Mesero inactivado
- GIVEN un mesero titular de `Mesero 2` en un evento futuro
- WHEN el admin lo inactiva
- THEN sigue en el equipo marcado como inactivo y las tareas de `Mesero 2` aparecen "sin responsable"

### Requirement: Tareas del evento

Cada tarea MUST pertenecer a un cargo del evento (`cargoId`) con `titulo`, `orden`, `estado` y opcional `origenCatalogoId`. Admin y jefe MUST crearlas, editarlas, moverlas y borrarlas, solo para ese evento y mientras sea editable, con auditoría (`tarea.crear|editar|mover|eliminar`). El jefe MAY ser titular de un cargo.

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

La UI MUST mostrar al mesero solo sus eventos y, dentro del evento, solo las tareas de su cargo (filtro de UI; las reglas no ocultan otros cargos del mismo evento). Admin y jefe MUST ver en vivo qué tareas se hicieron, cuáles faltan y cuáles quedan "sin responsable".

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
