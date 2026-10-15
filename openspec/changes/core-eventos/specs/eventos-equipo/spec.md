# Eventos y equipo Specification

## Purpose

CRUD de eventos, ciclo de vida por tiempo (derivado del reloj), archivar y borrar, detalle del evento ("Ingresar") con sus secciones, equipo del evento (registrados y no registrados), índice de membresía y visibilidad.

> Ya implementado (Revisión 2): en la pantalla Eventos, editar (admin y jefe), borrar (solo admin, modal de confirmación, cascada), botón "Ingresar" sin lógica y sin "Marcarme disponible". Este spec define el comportamiento final; el borrado pasa a un solo PATCH atómico.

## Requirements

### Requirement: CRUD de eventos

Admin y jefe MUST poder crear y editar eventos (`nombre`, fecha, hora de inicio, hora de fin, `personas?`). El modelo MUST guardar el inicio y el fin como instantes (`inicioTs`, `finTs`, además de `fechaInicio`/`fechaFin`): si `horaFin <= horaInicio`, el fin MUST caer al día siguiente (un sábado 22:00 a 03:00 termina el domingo). Solo el admin MUST poder borrar un evento (con las condiciones de "Archivar y borrar"); el jefe MUST NOT borrarlo ni borrar su `info`. El mesero MUST NOT escribir en `eventos/{eid}/info`. Editar MUST escribir paths de hoja (nunca reemplazar `info` entero) y recalcular los instantes. Cada operación MUST generar una entrada de auditoría en el mismo PATCH. Un evento finalizado MUST ser inmutable (ver "Ciclo de vida").

#### Scenario: Jefe crea evento
- GIVEN un jefe activo
- WHEN crea un evento con nombre, fechas y 120 personas
- THEN existe `eventos/{eid}/info` con `personas = 120` y una entrada `evento.crear` en `auditoria/{eid}`

#### Scenario: Mesero intenta crear
- GIVEN un mesero
- WHEN escribe `eventos/{eid}/info`
- THEN recibe 403

#### Scenario: Evento que cruza medianoche
- GIVEN un sábado con hora de inicio 22:00 y hora de fin 03:00
- WHEN el jefe lo guarda
- THEN `finTs` corresponde al domingo 03:00 y `finTs > inicioTs`

#### Scenario: Instantes inválidos
- GIVEN `finTs` menor o igual a `inicioTs` escrito directo por la REST
- WHEN se guarda
- THEN la operación se rechaza

#### Scenario: Jefe intenta borrar
- GIVEN un jefe
- WHEN borra `eventos/{eid}` o `eventos/{eid}/info`
- THEN recibe 403 y en la UI no ve el botón "Borrar"

#### Scenario: Editar no pisa otros campos
- GIVEN un evento con `personas = 150` y `archivado = true`
- WHEN el jefe cambia el nombre
- THEN `personas` y `archivado` siguen iguales

#### Scenario: Fechas congeladas
- GIVEN un evento ya pasado con `actividad`
- WHEN el admin intenta cambiar su fecha u hora por la REST
- THEN recibe 403 (así no se puede "mover al futuro" para borrarlo)

### Requirement: Ciclo de vida por tiempo

El estado del evento MUST derivarse comparando la hora actual con `inicioTs`/`finTs`; MUST NOT haber servidor ni cron que lo escriba. Tramos: (1) antes del inicio: el mesero ve el evento y su cargo pero no marca tareas; (2) desde la hora de inicio: se habilita marcar y desmarcar; (3) a fin + 2 horas: se cierra el marcado para meseros; (4) a fin + 4 horas: el evento queda **finalizado** y bloqueado (inmutable) para todos. Lo pasado o cerrado MUST ser imposible de editar. Las reglas de Firebase (que tienen `now`) MUST hacer cumplir la ventana de marcado y la inmutabilidad, no solo la UI. Entre fin + 2 h y fin + 4 h admin y jefe aún pueden marcar y editar; antes del inicio también (ASSUMED, pending user confirmation, Q12).

#### Scenario: Antes del inicio
- GIVEN un evento que empieza a las 20:00 y son las 18:00
- WHEN un mesero lo abre
- THEN ve el evento y su cargo, sin poder marcar

#### Scenario: En curso
- GIVEN la hora de inicio ya pasó
- WHEN el mesero titular marca una tarea
- THEN se acepta

#### Scenario: Marcado cerrado
- GIVEN fin + 2 h y 1 min
- WHEN el mesero intenta marcar
- THEN recibe 403 y el jefe todavía puede marcar

#### Scenario: Finalizado e inmutable
- GIVEN fin + 4 h y 1 min
- WHEN el jefe intenta editar `info`, `equipo`, `cargos` o `tareas`
- THEN recibe 403 y la UI muestra la etiqueta "Finalizado"

#### Scenario: Estado derivado, no escrito
- GIVEN nadie abrió la app en toda la noche
- WHEN a las fin + 4 h 1 min alguien abre el evento
- THEN se muestra "Finalizado" calculado por el reloj, sin ninguna escritura previa

### Requirement: Reactivar y finalizar a mano

Solo el admin MUST poder reactivar un evento finalizado (el jefe MUST NOT). Al reactivar, el evento MUST quedar abierto para admin y jefe (edición y marcado) hasta que el admin lo cierre a mano con Finalizar; los meseros siguen sin marcar. Mientras esté reabierto la UI MUST mostrar la etiqueta "Reabierto". Reactivar MUST guardar quién y cuándo (`reabiertoPor`, `reabiertoEn`) y registrar `evento.reactivar` en la auditoría. "Finalizar" a mano MUST solo cerrar un evento reabierto (Q14).

#### Scenario: Admin reactiva
- GIVEN un evento finalizado
- WHEN el admin lo reactiva
- THEN muestra "Reabierto", el jefe puede editar y marcar, los meseros no, y la auditoría tiene `evento.reactivar` con actor y hora

#### Scenario: Jefe intenta reactivar
- GIVEN un evento finalizado
- WHEN el jefe escribe `info/reabierto`
- THEN recibe 403 y no ve el botón "Reactivar"

#### Scenario: Cierre manual
- GIVEN un evento reabierto
- WHEN el admin toca "Finalizar"
- THEN vuelve a estar finalizado e inmutable y hay una entrada `evento.finalizar`

### Requirement: Archivar y borrar

Solo el admin MUST poder borrar o archivar. Un evento ya pasado (`now > finTs`) que **tiene datos** MUST NOT poder borrarse: solo se archiva. "Tiene datos" significa que existe `eventos/{eid}/actividad`, que se escribe en todo marcado de una tarea, propio o delegado, y que nadie puede desfijar (solo desaparece si el admin borra el evento entero) (ASSUMED, pending user confirmation, Q11). Si la lista de invitados (subida o marcas de asistencia) también cuenta como dato es una duda abierta (Q19, sin decidir); hoy no escribe `actividad`. Cualquier otro evento (futuro, o pasado sin actividad) MUST poder borrarse. Archivar MUST ocultar el evento de la lista principal sin borrar ningún dato (`info.archivado`, `archivadoPor/En`, auditoría `evento.archivar`) y MUST poder deshacerse. Las reglas MUST impedir el borrado de un evento pasado con `actividad`.

#### Scenario: Pasado con datos
- GIVEN un evento que ya terminó y tuvo tareas marcadas
- WHEN el admin lo abre
- THEN no hay botón "Borrar", sí "Archivar", y borrarlo por la REST da 403

#### Scenario: Pasado sin actividad
- GIVEN un evento que ya terminó sin ninguna tarea marcada
- WHEN el admin lo borra
- THEN se borra

#### Scenario: Futuro con equipo armado
- GIVEN un evento futuro con equipo y cargos asignados
- WHEN el admin lo borra
- THEN se borra

#### Scenario: Archivado
- GIVEN un evento archivado
- WHEN el admin o el jefe abren la lista principal
- THEN no aparece, pero sí en "Ver archivados" con todos sus datos y auditoría

#### Scenario: Jefe intenta archivar
- GIVEN un jefe
- WHEN escribe `info/archivado`
- THEN recibe 403

### Requirement: Borrado en cascada

Al borrar un evento permitido, el admin MUST confirmar en un modal y la app MUST borrar en un único PATCH `eventos/{eid}` completo (info, equipo, cargos, tareas, ocupacion, actividad), `membresias/{uid}/{eid}` de cada registrado e `invitados/{eid}`, junto con la entrada `evento.borrar`. La auditoría del evento MUST conservarse (queda huérfana).

#### Scenario: Admin borra
- GIVEN un evento borrable con equipo, cargos, tareas e invitados
- WHEN el admin confirma el borrado
- THEN desaparecen el evento, las membresías e invitados, y `auditoria/{eid}` sigue existiendo con `evento.borrar` al final

#### Scenario: Atomicidad del borrado
- GIVEN un PATCH de borrado en el que una hoja es rechazada
- WHEN se envía
- THEN el evento sigue completo

### Requirement: Detalle del evento

El botón "Ingresar" de cada card MUST abrir `/app/eventos/{eid}`. El detalle MUST mostrar secciones según el rol:

| Sección | Admin / jefe | Mesero miembro |
|---|---|---|
| Equipo del evento | sí | no |
| Cargos del evento | sí | no |
| Asignación | sí | no |
| Tareas | todas, en vivo, con "sin responsable" | solo las de su cargo |
| Invitados | sí (jefe: desde inicio − 1 h hasta finalizar) | solo si es titular de un cargo con `manejaInvitados`, desde inicio − 1 h hasta finalizar (ver `invitados-evento`) |
| Auditoría | sí (solo lectura) | no |

(La sección "Desmontaje / Inventario" queda **pospuesta, fuera del núcleo**.) La sección por defecto MUST ser Equipo del evento para admin y jefe, y Tareas para el mesero. El detalle MUST mostrar la etiqueta de estado derivado (Programado, En curso, Marcado cerrado, Finalizado, "Reabierto").

#### Scenario: Mesero ingresa
- GIVEN un mesero miembro y titular de `Mesero 2`
- WHEN toca "Ingresar"
- THEN ve la sección Tareas y no ve Equipo, Cargos, Asignación ni Auditoría

#### Scenario: Sección prohibida por URL
- GIVEN un mesero
- WHEN navega a `/app/eventos/{eid}/auditoria`
- THEN no ve la auditoría y es redirigido a `/app/eventos`

### Requirement: Miembros del equipo del evento

Admin y jefe MUST poder armar el equipo de cada evento dentro del evento (botón "Ingresar"), eligiendo entre los usuarios registrados activos (roles fijos: jefe o trabajador; portero, mesero, etc. son cargos que se asignan después; el admin no es asignable) o "usuario no registrado" (solo nombre; sus tareas las marcan admin y jefe). El equipo MUST admitir registrados activos de cualquier rol salvo el admin (clave `mid` = uid; el jefe puede ser miembro y titular) y no registrados (clave `nr_{pushId}`, solo `nombre`). Agregar un registrado MUST escribir en el mismo PATCH `equipo/{uid}`, `membresias/{uid}/{eid} = true` y la auditoría. Un mesero MUST NOT estar en dos eventos que se crucen en horario (tiene un solo evento a la vez); la app MUST rechazar agregarlo, o editar las fechas de un evento, si eso genera un cruce (validación de cliente; ASSUMED, pending user confirmation, Q13). Un fin que coincide con el inicio del siguiente no es cruce. Un miembro inactivado MUST seguir en el equipo del evento, marcado como inactivo.

#### Scenario: Cruce de horarios
- GIVEN un mesero en un evento de 20:00 a 02:00
- WHEN el jefe intenta agregarlo a otro evento de 23:00 a 04:00
- THEN la app lo rechaza con un mensaje en tuteo y no escribe

#### Scenario: Eventos consecutivos
- GIVEN un mesero en un evento que termina a las 02:00
- WHEN se lo agrega a otro que empieza a las 02:00
- THEN se acepta

#### Scenario: Agregar registrado
- GIVEN un uid activo
- WHEN el jefe lo agrega
- THEN existen `equipo/{uid}` y `membresias/{uid}/{eid}` atómicamente

#### Scenario: Agregar no registrado
- GIVEN un nombre sin cuenta
- WHEN el jefe lo agrega con "Agregar sin cuenta"
- THEN se crea `equipo/nr_{pushId}` con `registrado=false`, sin entrada en `membresias`, y se muestra con la etiqueta "Sin cuenta"

#### Scenario: Registrado con clave nr_
- GIVEN un miembro con `registrado = true`
- WHEN su clave empieza con `nr_`
- THEN la escritura se rechaza

### Requirement: Quitar miembro

Quitar a un miembro MUST borrar en un PATCH su `equipo` (incluido su puntero `cargoInvitadosId`), su `membresias` y su `titularId` en los cargos (el snapshot del cargo y su `ocupacion` se conservan), y MUST conservar la auditoría.

#### Scenario: Quitar titular
- GIVEN un miembro titular de un cargo
- WHEN el jefe lo quita
- THEN el cargo queda sin `titularId`, sus tareas pasan a "sin responsable", el cargo se puede asignar a otra persona (reutilizando el mismo snapshot) y la auditoría previa sigue intacta

### Requirement: Visibilidad

El mesero MUST listar sus eventos únicamente vía `membresias/{uid}`: solo ve los eventos donde está en el equipo, ordenados por fecha; el de hoy MUST ir primero y destacado, y si hoy tiene uno solo MUST abrirse directo. Un usuario registrado sin asignaciones MUST ver la pantalla vacía "No tienes eventos ni cargos asignados" y ningún dato de eventos hasta que lo asignen (lectura por evento/membresía en las reglas). Admin y jefe MUST ver todos los eventos no archivados (y los archivados en "Ver archivados"). Leer `eventos/{eid}` MUST estar permitido solo a admin, jefe y miembros. El auto-marcado de disponibilidad ("Marcarme disponible", `participantes.activo`) MUST NOT existir.

#### Scenario: Hoy con un solo evento
- GIVEN un mesero miembro de un único evento que ocurre hoy
- WHEN abre Eventos
- THEN se abre directo el detalle de ese evento

#### Scenario: Hoy primero
- GIVEN un mesero miembro de un evento de hoy y otro de la semana próxima
- WHEN abre Eventos
- THEN ve el de hoy primero y destacado, y luego el otro por fecha

#### Scenario: Sin asignaciones
- GIVEN un usuario registrado que nadie asignó a un evento
- WHEN abre Eventos
- THEN ve "No tienes eventos ni cargos asignados"

#### Scenario: Mesero lista eventos
- GIVEN un mesero miembro de A y no de B
- WHEN abre Eventos
- THEN ve A y no B

#### Scenario: Lectura ajena
- GIVEN un mesero no miembro de B
- WHEN hace GET `eventos/B`
- THEN recibe 403

#### Scenario: Lista completa por REST
- GIVEN un mesero
- WHEN hace GET `eventos?shallow=true`
- THEN recibe 403
