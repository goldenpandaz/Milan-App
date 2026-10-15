# Reglas de seguridad Specification

## Purpose

Helpers transversales y matriz de acceso en `database.rules.json`. Verificable con emulador de RTDB o checklist manual por rol.

## Requirements

### Requirement: Helpers y sin lectura raíz

Las reglas MUST definir `activo`, `esAdmin`, `esJefeOAdmin` y `esMiembro(eid)`, y MUST NOT tener `.read` en la raíz. Un usuario con `estado = inactivo` MUST ser negado en todo nodo.

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
| `usuarios/{uid}` r | sí | sí | propio | propio |
| `usuarios` w rol/estado | sí | no | no | no |
| `eventos/{eid}` r | sí | sí | si miembro | si miembro |
| `eventos/{eid}` w (info, equipo, cargos, tareas) | sí | sí | no | solo `tareas/.../estado` de su cargo |
| `membresias/{uid}` r | sí | sí | propio | propio |
| `inventario` r | sí | sí | si miembro | si miembro |
| `inventario` w | solo si titular Desmontaje | idem | no | sí (Desmontaje) |
| `invitados/{eid}` r | sí | sí | con flag/todos/portero | idem |
| `invitados/{eid}` w | sí | sí | no | no |
| `auditoria/{eid}` r | sí | sí | no | no |
| `auditoria/{eid}` create | sí | sí | sí (propia) | sí |
| `auditoria` update/delete | no | no | no | no |

#### Scenario: Mesero no miembro
- GIVEN un mesero que no está en `equipo` del evento B
- WHEN lee `eventos/B`, `inventario` de B o `invitados/B`
- THEN recibe 403 en cada uno

#### Scenario: Marcar tarea
- GIVEN un titular del cargo X
- WHEN cambia `estado` de una tarea con `cargoId = X`
- THEN se acepta
- AND con otro `cargoId` o campo distinto recibe 403

### Requirement: Escritura multi-path

Una acción con su auditoría MUST aceptarse o rechazarse completa en un PATCH a la raíz.

#### Scenario: Una hoja inválida
- GIVEN un PATCH con una hoja que viola una regla
- WHEN se envía
- THEN no se aplica ninguna hoja

### Requirement: Verificación

Cada fase MUST pasar la matriz en emulador o checklist manual antes del deploy. Comportamientos por confirmar: `child(null)` sin puntero, validación por hoja en PATCH raíz, `ts === now` vía REST.

#### Scenario: Puntero faltante
- GIVEN `cargoDesmontajeId` ausente
- WHEN se evalúa la regla de inventario
- THEN deniega sin error de evaluación que abra el acceso
