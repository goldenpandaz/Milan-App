# Cargos y tareas Specification

## Purpose

Cargos por evento, titulares, tareas, marcado propio y delegado, vista del mesero.

## Requirements

### Requirement: Cargos

Un evento MUST admitir cargos de tipo `mesero` (nombre autonumerado `Mesero N`), `portero`, `libre` (nombre libre) y `desmontaje`. Solo admin y jefe MUST crearlos o editarlos. (ASSUMED, pending user confirmation) Cada evento MUST tener exactamente un cargo `desmontaje`, referenciado por `info.cargoDesmontajeId`.

#### Scenario: Autonumeración
- GIVEN un evento con `Mesero 1` y `Mesero 2`
- WHEN el jefe agrega otro mesero
- THEN se llama `Mesero 3`

#### Scenario: Segundo Desmontaje
- GIVEN un evento que ya tiene Desmontaje
- WHEN se intenta crear otro
- THEN se rechaza

### Requirement: Titular

Cada cargo MUST tener como máximo un `titularId`, que MUST ser un `mid` del equipo y no estar inactivo. Asignar MUST auditar `asignar` con `actorUid` y `paraMid`.

#### Scenario: Asignar
- GIVEN un miembro activo del equipo
- WHEN el jefe lo asigna a `Portero`
- THEN `titularId = mid` y hay entrada de auditoría

#### Scenario: Asignar inactivo
- GIVEN un usuario inactivo
- WHEN se intenta asignar
- THEN no es elegible

### Requirement: Tareas

Cada tarea MUST pertenecer a un cargo (`cargoId`) con `titulo`, `orden` y `estado`. Admin y jefe MUST crearlas y editarlas.

#### Scenario: Crear tarea
- GIVEN un cargo existente
- WHEN el jefe crea una tarea
- THEN queda con `cargoId` y `estado` pendiente

### Requirement: Marcado propio

El titular de un cargo MUST poder marcar y desmarcar las tareas de ese cargo, cambiando solo `estado`. Cada marcado MUST auditarse.

#### Scenario: Mesero marca la suya
- GIVEN un mesero titular de `Mesero 1`
- WHEN marca una tarea de `Mesero 1`
- THEN `estado` cambia y se registra auditoría

#### Scenario: Tarea de otro cargo
- GIVEN un mesero que no es titular del cargo
- WHEN intenta marcar esa tarea
- THEN recibe 403

#### Scenario: Cambio de otros campos
- GIVEN el titular
- WHEN modifica `titulo`
- THEN recibe 403

### Requirement: Marcado delegado

Admin y jefe MUST poder marcar tareas de cargos con titular no registrado o sin titular; la auditoría MUST guardar `actorUid` y `paraMid`.

#### Scenario: Delegado
- GIVEN un cargo con titular `nr_x`
- WHEN el jefe marca una tarea
- THEN la auditoría guarda `actorUid = jefe` y `paraMid = nr_x`

### Requirement: Vista del mesero

La UI MUST mostrar al mesero solo sus eventos y las tareas de sus cargos (filtro de UI; las reglas no ocultan otros cargos del mismo evento).

#### Scenario: Filtro
- GIVEN un evento con tareas de tres cargos y el mesero titular de uno
- WHEN abre el evento
- THEN ve solo las tareas de su cargo
