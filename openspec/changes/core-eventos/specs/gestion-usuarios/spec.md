# Gestión de usuarios Specification

## Purpose

Roles, estado activo/inactivo, bloqueo de acceso, pantalla global "Equipo" y menú por rol. Solo el admin cambia roles y estado.

> **Revisión 5:** los roles fijos son solo **administrador**, **jefe_mesero** y **trabajador**. El identificador interno del trabajador sigue siendo `mesero` (no se tocan las reglas de `usuarios` ya desplegadas); la UI MUST mostrarlo como "Trabajador" (también en el control segmentado de Equipo: "Trabajador / Jefe"). Portero, mesero, etc. NO son roles: son **cargos** del catálogo que se asignan en cada evento (ver `catalogo-cargos`). En este spec, "mesero" = rol `mesero` = Trabajador.

> Ya implementado (Revisión 2): modelo de 3 roles (`administrador`, `jefe_mesero`, `mesero`) con alta directa como mesero, sin flujo "pendiente"; reglas de `usuarios` desplegadas; pantalla Equipo con `SegmentedControl` mesero↔jefe, orden admin → jefe → mesero y update optimista. Este spec agrega `inactivo` y fija lo ya hecho como requisito.

## Requirements

### Requirement: Alta directa como mesero

Un usuario que se registra MUST quedar con `rol = mesero` y `estado = activo`, sin aprobación previa. Solo puede crear su propio perfil y solo con esos valores.

#### Scenario: Registro
- GIVEN una persona sin cuenta
- WHEN se registra
- THEN existe `usuarios/{uid}` con `rol = mesero` y `estado = activo`

#### Scenario: Auto-alta como jefe
- GIVEN un usuario recién autenticado sin perfil
- WHEN escribe su perfil con `rol = jefe_mesero`
- THEN la RTDB responde 403

### Requirement: Estado de usuario

`usuarios/{uid}` MUST tener `estado` con valor `activo` o `inactivo`. Solo el admin MUST poder cambiar `estado` y `rol` de otro usuario (inactivar equivale a una baja). El admin MUST NOT poder cambiar su propio `rol` ni `estado`.

#### Scenario: Admin inactiva a un usuario
- GIVEN un admin y un mesero activo
- WHEN el admin inactiva al mesero
- THEN `estado` pasa a `inactivo`
- AND se guardan `estadoCambiadoPor` (uid del admin) y `estadoCambiadoEn` (ASSUMED, pending user confirmation: no hay auditoría global, Q4)

#### Scenario: No admin intenta cambiar estado
- GIVEN un jefe autenticado
- WHEN escribe `usuarios/{otroUid}/estado`
- THEN la RTDB responde 403

#### Scenario: Admin se inactiva a sí mismo
- GIVEN un admin
- WHEN escribe su propio `estado = inactivo`
- THEN la RTDB responde 403

### Requirement: Pantalla Equipo (global)

La pantalla "Equipo" (`/app/admin/equipo`) MUST listar todos los usuarios ordenados admin → jefe → mesero y MUST ser accesible solo para el admin (ASSUMED, pending user confirmation, Q5: el jefe no la ve). MUST permitir alternar mesero ↔ jefe con un control segmentado (update optimista que se revierte si la escritura falla) y activar/inactivar. Los inactivos MUST mostrarse en una sección aparte. El rol `administrador` MUST NOT asignarse desde la UI. El equipo de un evento es otra cosa: vive dentro del evento (ver `eventos-equipo`).

#### Scenario: Promover a jefe
- GIVEN el admin en Equipo y un mesero activo
- WHEN elige "Jefe" en el control segmentado
- THEN la UI cambia al instante y `usuarios/{uid}/rol = jefe_mesero`

#### Scenario: Falla la escritura
- GIVEN un cambio de rol optimista
- WHEN la RTDB responde error
- THEN la UI vuelve al rol anterior y muestra un mensaje en tuteo

#### Scenario: Jefe abre Equipo
- GIVEN un jefe
- WHEN navega a `/app/admin/equipo`
- THEN es redirigido a `/app/eventos`

### Requirement: Menú por rol

El menú MUST ser: admin → Eventos · Equipo · Cargos · Configuración; jefe → Eventos · Cargos; mesero → Eventos. MUST NOT existir ítems "Asignar", "Tareas" ni "Mis tareas": la asignación y las tareas viven dentro de cada evento.

#### Scenario: Menú del mesero
- GIVEN un mesero logueado
- WHEN ve el menú
- THEN solo aparece "Eventos"

#### Scenario: Menú del jefe
- GIVEN un jefe logueado
- WHEN ve el menú
- THEN aparecen "Eventos" y "Cargos", y no aparecen "Equipo" ni "Configuración"

### Requirement: Bloqueo de inactivos

Un usuario inactivo MUST NOT poder loguearse; si inicia sesión, el cliente MUST cerrar la sesión y mostrar un mensaje en tuteo (ej. "Tu cuenta está inactiva, habla con el administrador"). Las reglas MUST negar toda lectura y escritura a un inactivo, salvo leer su propio perfil.

#### Scenario: Login de inactivo
- GIVEN un usuario con `estado = inactivo`
- WHEN ingresa credenciales válidas
- THEN la sesión se cierra y ve el mensaje de cuenta inactiva

#### Scenario: Token de inactivo contra la REST
- GIVEN un inactivo con token válido
- WHEN hace GET a cualquier nodo distinto de su perfil
- THEN recibe 403

#### Scenario: Inactivado con la sesión abierta
- GIVEN un mesero logueado al que el admin inactiva
- WHEN su siguiente request a la RTDB recibe 403
- THEN el cliente refresca el perfil, cierra la sesión y muestra el mensaje

### Requirement: Un inactivo no es elegible

Los selectores de equipo del evento y de titular MUST excluir a los inactivos. Su historial (auditoría, marcados) MUST conservarse y seguir visible.

#### Scenario: Selector de equipo
- GIVEN un usuario inactivo
- WHEN el jefe abre el selector para agregar al equipo del evento
- THEN el inactivo no aparece

#### Scenario: Historial intacto
- GIVEN un inactivo con entradas de auditoría
- WHEN el admin revisa el evento
- THEN sus entradas siguen visibles

#### Scenario: Inactivado con eventos futuros
- GIVEN un mesero inactivado que es titular de un cargo en un evento futuro
- WHEN el jefe abre el evento
- THEN el mesero sigue en el equipo del evento marcado como inactivo y las tareas de su cargo aparecen "sin responsable" (ver `cargos-tareas`)
