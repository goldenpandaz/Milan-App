# Eventos y equipo Specification

## Purpose

CRUD de eventos, equipo (registrados y no registrados), índice de membresía y visibilidad.

## Requirements

### Requirement: CRUD de eventos

Admin y jefe MUST poder crear, editar y borrar eventos (`nombre`, `fechaInicio`, `fechaFin`). El mesero MUST NOT escribir en `eventos/{eid}/info`. Cada operación MUST generar una entrada de auditoría en el mismo PATCH.

#### Scenario: Jefe crea evento
- GIVEN un jefe activo
- WHEN crea un evento con nombre y fechas
- THEN existe `eventos/{eid}/info` y una entrada en `auditoria/{eid}`

#### Scenario: Mesero intenta crear
- GIVEN un mesero
- WHEN escribe `eventos/{eid}/info`
- THEN recibe 403

#### Scenario: Fechas inválidas
- GIVEN `fechaFin` anterior a `fechaInicio`
- WHEN se guarda
- THEN la operación se rechaza

### Requirement: Miembros del equipo

El equipo MUST admitir registrados (clave `mid` = uid) y no registrados (clave `nr_{pushId}`, solo `nombre`). Agregar un registrado MUST escribir en el mismo PATCH `equipo/{uid}`, `membresias/{uid}/{eid} = true` y la auditoría.

#### Scenario: Agregar registrado
- GIVEN un uid activo
- WHEN el jefe lo agrega
- THEN existen `equipo/{uid}` y `membresias/{uid}/{eid}` atómicamente

#### Scenario: Agregar no registrado
- GIVEN un nombre sin cuenta
- WHEN el jefe lo agrega
- THEN se crea `equipo/nr_{pushId}` con `registrado=false` y sin entrada en `membresias`

### Requirement: Quitar miembro

Quitar a un miembro MUST borrar en un PATCH su `equipo`, su `membresias` y su `titularId` en los cargos, y MUST conservar la auditoría.

#### Scenario: Quitar titular
- GIVEN un miembro titular de un cargo
- WHEN el jefe lo quita
- THEN el cargo queda sin `titularId` y la auditoría previa sigue intacta

### Requirement: Visibilidad

El mesero MUST listar sus eventos únicamente vía `membresias/{uid}`. Leer `eventos/{eid}` MUST estar permitido solo a admin, jefe y miembros.

#### Scenario: Mesero lista eventos
- GIVEN un mesero miembro de A y no de B
- WHEN abre su lista
- THEN ve A y no B

#### Scenario: Lectura ajena
- GIVEN un mesero no miembro de B
- WHEN hace GET `eventos/B`
- THEN recibe 403
