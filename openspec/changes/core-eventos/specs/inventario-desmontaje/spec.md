# Inventario de desmontaje Specification

> **POSPUESTO, NO IMPLEMENTAR (Revisión 3).** Desmontaje, montaje e inventario quedan fuera del núcleo: ocurren fuera del horario del evento y el usuario aún no sabe cómo manejarlos. Este spec se conserva sin cambios como referencia para cuando se decida. Mientras tanto no existe el tipo de cargo `desmontaje`, ni `info.cargoDesmontajeId`, ni el nodo `inventario`, ni la sección "Desmontaje / Inventario". Ver "Pendiente / fuera del núcleo" en `tasks.md`.

## Purpose

Inventario del salón (`# | nombre | estado | notas`) atado al cargo Desmontaje de cada evento. Se ve en la sección "Desmontaje / Inventario" del detalle del evento. El cargo Desmontaje puede venir de la copia del catálogo o crearse en el evento (ver `cargos-tareas`).

## Requirements

### Requirement: Ítems

El inventario es UNA lista global del salón (`inventario/{itemId}`), no una por evento. Cada ítem MUST tener `nombre`, `orden`, `estado`, `notas`, `eventoId` (el evento bajo el que se hizo la última edición), `actualizadoPor/En` y opcional `archivado`. (ASSUMED, pending user confirmation, Q6) Cualquier usuario activo MUST poder leer el inventario; la UI lo muestra solo a admin, jefe y al titular de Desmontaje del evento.

#### Scenario: Lectura por el titular
- GIVEN el titular de Desmontaje de un evento
- WHEN abre la sección Inventario
- THEN ve todos los ítems no archivados del salón

#### Scenario: Mesero sin Desmontaje
- GIVEN un mesero miembro que no es titular de Desmontaje
- WHEN abre el evento
- THEN no ve la sección Inventario

#### Scenario: Inactivo
- GIVEN un usuario inactivo
- WHEN lee `inventario`
- THEN recibe 403

#### Scenario: Archivar
- GIVEN un ítem que el salón ya no tiene
- WHEN el titular lo archiva
- THEN queda con `archivado = true`, no se muestra y no se borra físicamente

### Requirement: Valor de estado (PENDING USER DECISION)

El conjunto de valores de `estado` está PENDIENTE de decisión del usuario (Q1). Opción A (default de implementación): `hay` / `queda poco` / `no hay`. Opción B: dos checkboxes excluyentes (check = hay, X = no hay). Los escenarios de abajo MUST valer con cualquiera de las dos. El `estado` MUST pertenecer al conjunto elegido y las reglas MUST validarlo.

#### Scenario: Valor fuera de conjunto
- GIVEN un titular de Desmontaje
- WHEN guarda un `estado` que no pertenece al conjunto elegido
- THEN la escritura se rechaza

### Requirement: Permiso de edición

Solo el titular del cargo Desmontaje del evento MUST poder crear, editar y archivar ítems, y solo mientras el evento no esté finalizado. Admin y jefe supervisan (solo lectura) salvo que sean titulares. (ASSUMED, pending user confirmation, Q2) Si el titular no es registrado, admin o jefe MUST poder editar en su nombre, auditado como "por X para Y".

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

#### Scenario: Evento finalizado
- GIVEN un evento con `estado = finalizado`
- WHEN su titular de Desmontaje edita un ítem
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
