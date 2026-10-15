# Catálogo de cargos Specification

## Purpose

Catálogo GENERAL de cargos y sus tareas (pantalla "Cargos", `/app/cargos`), independiente de los eventos. Es solo la **plantilla**: (Rev. 6) cada evento copia el catálogo completo, tal como está, la primera vez que admin o jefe entran a él, y desde ahí su copia es independiente (ver `cargos-tareas`). Reemplaza la vieja página "Tareas". (Rev. 6) No existe el cargo genérico `Apoyo` ni ninguna noción de "cargo para varias personas": cada cargo tiene un solo titular en cada evento, y si faltan cargos se crean dentro del evento.

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

Cada cargo del catálogo MUST tener `nombre` (libre, 1..60: `Portero`, `Mesero 1`, `Bar`, etc.), `orden` (máximo + 1 al crear, sin renumerar) y `manejaInvitados`. (Rev. 6) El catálogo MUST NOT tener `tipo` ni ningún campo de "varias personas" (`apoyo`/`variasPersonas` eliminados). Admin y jefe MUST poder crear, renombrar y borrar cargos. Borrar un cargo MUST borrar sus tareas en la misma escritura y MUST NOT afectar eventos que ya copiaron el catálogo. El desmontaje queda **pospuesto, fuera del núcleo** (ver `inventario-desmontaje`).

Los roles fijos son solo administrador, jefe_mesero y trabajador (id interno `mesero`); mesero, portero, etc. son cargos (Rev. 5).

#### Scenario: Crear un cargo
- GIVEN un catálogo con `Portero` (orden 1) y `Mesero 1` (orden 2)
- WHEN el jefe crea `Mesero 2`
- THEN queda con `orden = 3` y `manejaInvitados = false`

#### Scenario: Borrar cargo con tareas
- GIVEN un cargo del catálogo con 3 tareas
- WHEN el admin lo borra
- THEN desaparecen el cargo y sus 3 tareas en una sola escritura

#### Scenario: Campo desconocido
- GIVEN una escritura de cargo con `tipo` o `variasPersonas`
- WHEN se envía
- THEN se rechaza (`$other: false`)

### Requirement: Permiso "maneja la lista de invitados"

Cada cargo del catálogo MUST tener el flag booleano `manejaInvitados` (default `false`), que admin y jefe MAY activar o desactivar ("Este cargo maneja la lista de invitados"). El flag MUST viajar en la copia del cargo cuando un evento copia el catálogo; cambiarlo después en el catálogo MUST NOT afectar eventos ya copiados. Dentro del evento, el permiso vale según la copia del evento, no según el catálogo (ver `invitados-evento`).

#### Scenario: Activar el permiso
- GIVEN el cargo `Portero` del catálogo
- WHEN el jefe activa "Este cargo maneja la lista de invitados"
- THEN el cargo queda con `manejaInvitados = true` y los eventos que copien el catálogo después lo traen así

#### Scenario: Cambiar el permiso tras copiar
- GIVEN un evento que ya copió `Portero` con `manejaInvitados = true`
- WHEN el admin lo desactiva en el catálogo
- THEN el `Portero` del evento conserva `manejaInvitados = true`

### Requirement: Tareas del catálogo

Cada cargo del catálogo MUST poder tener tareas (`titulo`, `orden`) anidadas bajo el cargo. Las tareas del catálogo MUST NOT tener `estado`: no se marcan. Admin y jefe MUST poder crearlas, renombrarlas y borrarlas.

#### Scenario: Crear tarea en el catálogo
- GIVEN el cargo `Portero` del catálogo
- WHEN el jefe agrega "Recibir invitados en la puerta"
- THEN queda en `catalogo/cargos/{ccid}/tareas/{ctid}` con `orden` = máximo + 1

### Requirement: Trazabilidad del catálogo

Toda escritura bajo un cargo del catálogo (incluidas sus tareas) MUST actualizar `actualizadoPor` (= auth.uid) y `actualizadoEn` (= hora del servidor) del cargo en la misma escritura. Los cambios del catálogo MUST NOT escribir auditoría de eventos (ASSUMED, Q4).

#### Scenario: Editar una tarea
- GIVEN una tarea del cargo `Mesero 1`
- WHEN el admin cambia el título
- THEN el cargo `Mesero 1` queda con `actualizadoPor = admin` y `actualizadoEn` del servidor

#### Scenario: Timestamp falso
- GIVEN una escritura con `actualizadoEn` fijo y no el del servidor
- WHEN se envía
- THEN se rechaza

### Requirement: Independencia de los eventos

Editar o borrar algo del catálogo MUST NOT modificar ningún evento que ya haya copiado el catálogo. Los eventos que todavía no lo copiaron traerán el catálogo vigente al primer ingreso.

#### Scenario: Editar después de copiar
- GIVEN un evento que ya copió el catálogo
- WHEN el jefe renombra `Portero` a `Recepción` en el catálogo
- THEN el cargo del evento sigue llamándose `Portero` y conserva sus tareas

#### Scenario: Borrar después de copiar
- GIVEN un evento con un cargo cuyo `origenCatalogoId` apunta a un cargo del catálogo
- WHEN ese cargo se borra del catálogo
- THEN el cargo del evento y sus tareas siguen intactos

#### Scenario: Cambiar tareas no afecta lo ya copiado
- GIVEN un evento que ya copió `Mesero 1`
- WHEN el admin agrega una tarea a `Mesero 1` en el catálogo
- THEN el `Mesero 1` del evento no tiene la tarea nueva
