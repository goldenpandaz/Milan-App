# Catálogo de cargos Specification

## Purpose

Catálogo GENERAL de cargos y sus tareas (pantalla "Cargos", `/app/cargos`), independiente de los eventos. Es solo la **plantilla**: no se copia entero a ningún evento. Cuando un cargo se asigna a una persona en un evento, el evento guarda su propia copia (snapshot) del nombre y de las tareas de ese momento (ver `cargos-tareas`). Reemplaza la vieja página "Tareas".

## Requirements

### Requirement: Acceso al catálogo

Solo admin y jefe MUST poder leer y escribir `catalogo`. El mesero MUST NOT verlo: ni en el menú ni por la REST.

#### Scenario: Jefe abre Cargos
- GIVEN un jefe activo
- WHEN abre "Cargos"
- THEN ve los cargos del catálogo con sus tareas

#### Scenario: Mesero lee el catálogo
- GIVEN un mesero
- WHEN hace GET `catalogo`
- THEN recibe 403

#### Scenario: Mesero navega a Cargos
- GIVEN un mesero
- WHEN navega a `/app/cargos`
- THEN es redirigido a `/app/eventos`

### Requirement: Cargos del catálogo

El catálogo MUST admitir cargos de tipo `mesero` (nombre autonumerado `Mesero N`, N = máximo existente + 1, sin renumerar), `libre` (nombre libre: `Portero`, `Recepción`, `Bar`, etc.) y `apoyo` (cargo genérico, con tareas genéricas, asignable a varias personas a la vez en un evento; no se inventan cargos como "Mesero 6" para cubrir el exceso de personas). Admin y jefe MUST poder crear, renombrar y borrar cargos, incluidos los de tipo `apoyo`. Borrar un cargo MUST borrar sus tareas en la misma escritura y MUST NOT afectar eventos existentes ni pasados. El tipo `desmontaje` queda **pospuesto, fuera del núcleo** (ver `inventario-desmontaje`): MUST NOT ofrecerse en la UI ni aceptarse en las reglas.

(Rev. 5) El tipo `portero` desaparece: "Portero" es un cargo `libre` más; lo que antes lo hacía especial (ver la lista de invitados) ahora es el permiso `manejaInvitados`, que puede tener cualquier cargo. Los roles fijos son solo administrador, jefe_mesero y trabajador (id interno `mesero`); mesero, portero, etc. son cargos.

#### Scenario: Autonumeración en el catálogo
- GIVEN un catálogo con `Mesero 1` y `Mesero 3`
- WHEN el jefe agrega un mesero
- THEN se llama `Mesero 4`

#### Scenario: Agregar Apoyo
- GIVEN un jefe en "Cargos"
- WHEN toca "+ Apoyo" y agrega tareas genéricas
- THEN el catálogo tiene un cargo de tipo `apoyo` con sus tareas

#### Scenario: Desmontaje no disponible
- GIVEN un jefe en "Cargos"
- WHEN abre las opciones de alta
- THEN no existe "+ Desmontaje" y una escritura con `tipo = desmontaje` se rechaza

#### Scenario: Borrar cargo con tareas
- GIVEN un cargo del catálogo con 3 tareas
- WHEN el admin lo borra
- THEN desaparecen el cargo y sus 3 tareas en una sola escritura

### Requirement: Permiso "maneja la lista de invitados"

Cada cargo del catálogo MUST tener el flag booleano `manejaInvitados` (default `false`), que admin y jefe MAY activar o desactivar ("Este cargo maneja la lista de invitados"). El flag MUST copiarse en el snapshot del cargo al asignarlo en un evento; cambiarlo después en el catálogo MUST NOT afectar eventos con ese cargo ya asignado (ver `invitados-evento`). Cualquier tipo de cargo (`mesero`, `libre`, `apoyo`) MAY tenerlo.

#### Scenario: Activar el permiso
- GIVEN el cargo `Portero` (tipo `libre`) del catálogo
- WHEN el jefe activa "Este cargo maneja la lista de invitados"
- THEN el cargo queda con `manejaInvitados = true` y los próximos snapshots lo copian

#### Scenario: Cambiar el permiso tras asignar
- GIVEN un evento donde `Portero` ya se asignó con `manejaInvitados = true`
- WHEN el admin lo desactiva en el catálogo
- THEN el cargo del evento conserva `manejaInvitados = true`

### Requirement: Tareas del catálogo

Cada cargo del catálogo MUST poder tener tareas (`titulo`, `nota?`, `orden`) anidadas bajo el cargo. Las tareas del catálogo MUST NOT tener `estado`: no se marcan. Admin y jefe MUST poder crearlas, editarlas y borrarlas.

#### Scenario: Crear tarea en el catálogo
- GIVEN el cargo `Portero` (tipo `libre`) del catálogo
- WHEN el jefe agrega "Recibir invitados en la puerta"
- THEN queda en `catalogo/cargos/{ccid}/tareas/{ctid}` con `orden` = máximo + 1

### Requirement: Trazabilidad del catálogo

Toda escritura bajo un cargo del catálogo (incluidas sus tareas) MUST actualizar `actualizadoPor` (= auth.uid) y `actualizadoEn` (= hora del servidor) del cargo en la misma escritura. Los cambios del catálogo MUST NOT escribir auditoría de eventos (ASSUMED, pending user confirmation, Q4).

#### Scenario: Editar una tarea
- GIVEN una tarea del cargo `Mesero 1`
- WHEN el admin cambia el título
- THEN el cargo `Mesero 1` queda con `actualizadoPor = admin` y `actualizadoEn` del servidor

#### Scenario: Timestamp falso
- GIVEN una escritura con `actualizadoEn` fijo y no el del servidor
- WHEN se envía
- THEN se rechaza

### Requirement: Independencia de los eventos

Editar o borrar algo del catálogo MUST NOT modificar ningún evento, haya copiado o no ese cargo.

#### Scenario: Editar después de asignar
- GIVEN un evento donde `Portero` ya se asignó a una persona (snapshot)
- WHEN el jefe renombra `Portero` en el catálogo a `Recepción`
- THEN el cargo del evento sigue llamándose `Portero` y conserva sus tareas

#### Scenario: Borrar después de asignar
- GIVEN un evento con un cargo cuyo `origenCatalogoId` apunta a un cargo del catálogo
- WHEN ese cargo se borra del catálogo
- THEN el cargo del evento y sus tareas siguen intactos, también en eventos pasados

#### Scenario: Cambiar tareas no afecta lo ya asignado
- GIVEN un evento donde `Mesero 1` ya se asignó
- WHEN el admin agrega una tarea a `Mesero 1` en el catálogo
- THEN el `Mesero 1` del evento no tiene la tarea nueva
