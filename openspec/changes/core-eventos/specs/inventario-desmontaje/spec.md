# Inventario de desmontaje Specification

## Purpose

Inventario del salón (`# | nombre | estado | notas`) atado al cargo Desmontaje.

## Requirements

### Requirement: Ítems

Cada ítem MUST tener `nombre`, `orden`, `estado`, `notas`, `eventoId`, `actualizadoPor/En`. Admin, jefe y miembros del evento MUST poder leer el inventario del evento.

#### Scenario: Lectura por miembro
- GIVEN un miembro del evento
- WHEN lista el inventario
- THEN ve los ítems de su evento

#### Scenario: Lectura ajena
- GIVEN un mesero no miembro
- WHEN lee un ítem de ese evento
- THEN recibe 403

### Requirement: Valor de estado (PENDING USER DECISION)

El conjunto de valores de `estado` está PENDIENTE de decisión del usuario (Q1). Opción A: `hay` / `queda poco` / `no hay`. Opción B: dos checkboxes excluyentes (check = hay, X = no hay). Los escenarios de abajo MUST valer con cualquiera de las dos. El `estado` MUST pertenecer al conjunto elegido y las reglas MUST validarlo.

#### Scenario: Valor fuera de conjunto
- GIVEN un titular de Desmontaje
- WHEN guarda un `estado` que no pertenece al conjunto elegido
- THEN la escritura se rechaza

### Requirement: Permiso de edición

Solo el titular del cargo Desmontaje del evento MUST poder crear, editar y borrar ítems. Admin y jefe supervisan (solo lectura) salvo que sean titulares. (ASSUMED, pending user confirmation) Si el titular no es registrado, admin o jefe MUST poder editar en su nombre, auditado como "por X para Y".

#### Scenario: Titular edita
- GIVEN un mesero titular de Desmontaje
- WHEN cambia el `estado` de un ítem
- THEN se guarda con `actualizadoPor/En` y auditoría

#### Scenario: Otro mesero
- GIVEN un mesero que no es titular de Desmontaje
- WHEN edita un ítem
- THEN recibe 403

#### Scenario: Jefe no titular
- GIVEN un jefe y un titular registrado
- WHEN el jefe edita
- THEN recibe 403

#### Scenario: Titular no registrado
- GIVEN titular `nr_x`
- WHEN el jefe edita un ítem
- THEN se guarda y la auditoría indica `actorUid = jefe`, `paraMid = nr_x`

#### Scenario: Evento sin Desmontaje
- GIVEN `cargoDesmontajeId` ausente
- WHEN cualquier mesero intenta escribir
- THEN recibe 403

### Requirement: Auditoría y snapshot

Cada edición MUST auditarse. Al finalizar el evento MUST guardarse un snapshot completo del inventario en la auditoría.

#### Scenario: Finalizar
- GIVEN un evento con inventario
- WHEN pasa a finalizado
- THEN la auditoría contiene el snapshot con todos los ítems

## Alternativas de Q1 (nota)

- A: más expresivo (alerta "queda poco"); 3 valores a validar.
- B: UI más simple; 2 valores excluyentes, sin nivel intermedio.
