# Gestión de usuarios Specification

## Purpose

Roles, estado activo/inactivo y bloqueo de acceso. Solo el admin cambia roles y estado.

## Requirements

### Requirement: Estado de usuario

`usuarios/{uid}` MUST tener `estado` con valor `activo` o `inactivo`. Solo el admin MUST poder cambiar `estado` y `rol`.

#### Scenario: Admin inactiva a un usuario
- GIVEN un admin y un mesero activo
- WHEN el admin inactiva al mesero
- THEN `estado` pasa a `inactivo`
- AND se guardan `estadoCambiadoPor` (uid del admin) y `estadoCambiadoEn` (ASSUMED, pending user confirmation: no hay auditoría global)

#### Scenario: No admin intenta cambiar estado
- GIVEN un jefe autenticado
- WHEN escribe `usuarios/{otroUid}/estado`
- THEN la RTDB responde 403

### Requirement: Bloqueo de inactivos

Un usuario inactivo MUST NOT poder loguearse; si inicia sesión, el cliente MUST cerrar la sesión y mostrar un mensaje en tuteo (ej. "Tu cuenta está inactiva, habla con el administrador"). Las reglas MUST negar toda lectura y escritura a un inactivo.

#### Scenario: Login de inactivo
- GIVEN un usuario con `estado = inactivo`
- WHEN ingresa credenciales válidas
- THEN la sesión se cierra y ve el mensaje de cuenta inactiva

#### Scenario: Token de inactivo contra la REST
- GIVEN un inactivo con token válido
- WHEN hace GET a cualquier nodo
- THEN recibe 403

### Requirement: Un inactivo no es elegible

Los selectores de equipo, titular y asignación MUST excluir a los inactivos. Su historial (auditoría, marcados) MUST conservarse y seguir visible.

#### Scenario: Selector de equipo
- GIVEN un usuario inactivo
- WHEN el jefe abre el selector para agregar al equipo
- THEN el inactivo no aparece

#### Scenario: Historial intacto
- GIVEN un inactivo con entradas de auditoría
- WHEN el admin revisa el evento
- THEN sus entradas siguen visibles
