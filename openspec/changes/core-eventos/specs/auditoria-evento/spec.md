# Auditoría por evento Specification

## Purpose

Log append-only por evento, con revisión por evento y por persona.

## Requirements

### Requirement: Entrada append-only

Toda entrada en `auditoria/{eid}/{pushId}` MUST tener `accion`, `actorUid`, `objetivo`, `detalle`, `ts` y opcional `paraMid`. Las reglas MUST exigir `!data.exists()`, `actorUid === auth.uid` y `ts === now`. Ninguna entrada MUST poder actualizarse ni borrarse. (ASSUMED, pending user confirmation) No hay auditoría global.

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

MUST registrarse: asignación, marcado (propio y delegado), subida de invitados, edición de inventario, alta y baja de miembros, CRUD de eventos y snapshot de inventario. Cada acción MUST escribirse junto con su efecto en un único PATCH.

#### Scenario: Atomicidad
- GIVEN una asignación
- WHEN la entrada de auditoría es rechazada
- THEN la asignación tampoco se aplica

### Requirement: Lectura y revisión

Solo admin y jefe MUST leer la auditoría. El admin MUST poder revisar un evento y ver por persona sus cargos, quién se los asignó y qué marcó. Las entradas de usuarios inactivos MUST seguir visibles.

#### Scenario: Mesero lee
- GIVEN un mesero
- WHEN lee `auditoria/{eid}`
- THEN recibe 403

#### Scenario: Vista por persona
- GIVEN un miembro con cargos y marcados
- WHEN el admin filtra por esa persona
- THEN ve cargos, asignador y marcados
