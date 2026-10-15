# Invitados del evento Specification

## Purpose

Subir, ver y descargar la lista de invitados (.xlsx en base64 en `invitados/{eid}`).

## Requirements

### Requirement: Subida

Admin y jefe MUST poder subir un .xlsx guardado como `nombreArchivo`, `tamano`, `base64`, `subidoPor/En`. El `base64` MUST NOT exceder ~1,37M caracteres (~1 MB). La subida MUST auditarse. El parseo del Excel está fuera de alcance.

#### Scenario: Subida válida
- GIVEN un jefe y un .xlsx de 500 KB
- WHEN lo sube
- THEN existe `invitados/{eid}` y una entrada de auditoría

#### Scenario: Archivo grande
- GIVEN un archivo que supera el límite
- WHEN se sube
- THEN la escritura se rechaza y el usuario ve un mensaje de tamaño máximo

#### Scenario: Mesero sube
- GIVEN un mesero
- WHEN escribe `invitados/{eid}`
- THEN recibe 403

### Requirement: Acceso de lectura

Pueden leer: admin, jefe, o un miembro con `portero` o `verInvitados` verdadero, o cualquier miembro si `info.invitadosTodos` es verdadero. El resto MUST recibir 403.

#### Scenario: Portero
- GIVEN un miembro con `portero = true`
- WHEN descarga
- THEN obtiene el archivo

#### Scenario: Elegido
- GIVEN un miembro con `verInvitados = true`
- WHEN descarga
- THEN obtiene el archivo

#### Scenario: Todos
- GIVEN `invitadosTodos = true`
- WHEN cualquier miembro descarga
- THEN obtiene el archivo

#### Scenario: Sin permiso
- GIVEN un miembro sin flags e `invitadosTodos = false`
- WHEN lee `invitados/{eid}`
- THEN recibe 403

### Requirement: Integridad de descarga

El archivo descargado MUST ser idéntico byte a byte al original. Leer `eventos/{eid}` MUST NOT traer el blob.

#### Scenario: Round-trip
- GIVEN un .xlsx subido
- WHEN un autorizado lo descarga
- THEN su hash coincide con el original

### Requirement: Flags de acceso

Solo admin y jefe MUST poder modificar `verInvitados` e `invitadosTodos`.

#### Scenario: Mesero cambia flag
- GIVEN un mesero miembro
- WHEN pone `verInvitados = true` en su propio `equipo`
- THEN recibe 403
