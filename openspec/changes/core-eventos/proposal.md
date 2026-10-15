# Proposal: core-eventos

> Reemplaza a `puestos-por-evento`. Su exploración sigue valiendo para quirks y servicios, pero "puesto" pasa a llamarse **cargo**, `participantes.activo` (que cada uno activaba por su cuenta) desaparece y no hay migración: hoy la DB solo tiene `/usuarios` con Milan.

## Intent

La app no refleja cómo se trabaja de verdad: la asignación va directo a un uid, la visibilidad es solo de UI (`.read` global), el inventario cuelga de un puntero frágil y no hay rastro de quién hizo qué. Necesitamos este modelo: **Evento → Equipo → Cargos → Tareas**, con permisos reales en las reglas, inventario atado al cargo Desmontaje, lista de invitados por evento y una auditoría append-only.

## Scope

### In Scope
- Usuarios: volver a agregar `inactivo`; solo el admin activa e inactiva. Un inactivo no puede loguearse ni ser elegido, y su historial se conserva.
- Eventos (nombre, fechas), equipo con miembros registrados y "no registrados" (solo nombre).
- Cargos por evento (`Mesero N` autonumerado, `Portero`, nombre libre, `Desmontaje`), tareas por cargo, asignar un titular a cada cargo.
- Vista del mesero: solo sus eventos y las tareas de sus cargos; puede marcar y desmarcar.
- Marcado delegado: admin o jefe marcan por un miembro no registrado.
- Inventario del salón (`# | nombre | estado | notas`), lo edita el titular de Desmontaje.
- Invitados: el .xlsx en base64 dentro de la RTDB (≤ ~1 MB), con reglas de quién lo ve.
- Auditoría por evento, append-only, de solo lectura para admin y jefe.
- Reescritura de `database.rules.json` con `.read` restringido.

### Out of Scope
- Sección protocolo, plantillas, push, modo oscuro.
- Cloud Functions, Storage o cualquier servicio nuevo de Firebase.
- Parsear el Excel.
- Ocultar las tareas de otros cargos a nivel de reglas dentro de un mismo evento (ese filtro queda en la UI).

## Capabilities

`openspec/specs/` está vacío, así que todas las capacidades son nuevas.

### New Capabilities
- `gestion-usuarios`: roles, activo/inactivo, bloqueo del login.
- `eventos-equipo`: CRUD de eventos, equipo (registrados y no registrados), índice de membresía, visibilidad.
- `cargos-tareas`: cargos, titulares, tareas, marcado propio y delegado, vista del mesero.
- `inventario-desmontaje`: ítems del salón y permiso de edición por cargo.
- `invitados-evento`: subir, ver y descargar el xlsx, con reglas de acceso.
- `auditoria-evento`: log append-only, eventos registrados, revisión por evento.
- `reglas-seguridad`: helpers transversales y matriz de lectura y escritura.

### Modified Capabilities
None.

## Approach

### Modelo de datos (RTDB)
| Path | Contenido |
|---|---|
| `usuarios/{uid}` | `nombre, email, rol, estado: activo\|inactivo` |
| `eventos/{eid}/info` | `nombre, fechaInicio, fechaFin, estado, cargoDesmontajeId?, invitadosTodos` |
| `eventos/{eid}/equipo/{mid}` | `nombre, registrado, portero: bool, verInvitados: bool`. `mid` es el uid si está registrado, o `nr_{pushId}` si no |
| `eventos/{eid}/cargos/{cid}` | `nombre, tipo: mesero\|portero\|desmontaje\|libre, orden, titularId?` (un `mid`) |
| `eventos/{eid}/tareas/{tid}` | `titulo, cargoId, nota?, orden, estado` |
| `membresias/{uid}/{eid}` | `true`: índice para que el mesero descubra sus eventos |
| `inventario/{itemId}` | `nombre, orden, estado, notas, eventoId, actualizadoPor/En` |
| `invitados/{eid}` | `nombreArchivo, tamano, base64, subidoPor/En` |
| `auditoria/{eid}/{pushId}` | `accion, actorUid, paraMid?, objetivo, detalle, ts` |

### Estrategia de reglas
- Helpers: `activo(auth)`, `esAdmin`, `esJefeOAdmin`, `esMiembro(eid) = equipo/{auth.uid}.exists()`.
- Se elimina el `.read` raíz. Lectura de `eventos/{eid}`: jefe o admin, o miembro. Las RTDB rules no filtran consultas, por eso existe el índice `membresias`.
- Marcar una tarea: `cargos/{data.cargoId}/titularId === auth.uid` y solo puede cambiar `estado`. Jefe y admin pueden marcar siempre.
- Escribir inventario: `newData.eventoId` → `info.cargoDesmontajeId` → `titularId === auth.uid` (doble lookup).
- Leer invitados: jefe o admin, o `equipo/{uid}` con `portero || verInvitados || info.invitadosTodos`. Límite de tamaño con `.validate` sobre `base64.length` (~1,37M caracteres).
- Auditoría: `!data.exists()`, `actorUid === auth.uid`, `ts === now` (con `{".sv":"timestamp"}`). No se puede actualizar ni borrar.
- Cada acción se escribe junto con su entrada de auditoría en un único PATCH multi-path a la raíz, así quedan atómicas (pushIds generados en el cliente).

### Mapeo de supuestos
- Cuando un inactivo se loguea, el cliente cierra la sesión; las reglas niegan todo. Auth sigue existiendo porque no hay Admin SDK.
- Admin y jefe supervisan el inventario, pero solo lo editan si son titulares de Desmontaje.
- Sacar a alguien del equipo borra en el mismo PATCH su entrada en `equipo`, su entrada en `membresias` y su `titularId` en los cargos. La auditoría lo conserva.
- Cada edición de inventario se audita, y al finalizar el evento se guarda un snapshot completo en la auditoría.

### Entrega por fases (cada una se puede publicar sola)
1. **Usuarios + reglas base**: `inactivo`, toggle en Equipo, bloqueo de login, helpers y `.read` por nodo.
2. **Eventos + equipo + visibilidad + infraestructura de auditoría**: `AuditService`, nodo y reglas. A partir de acá todo escribe log.
3. **Cargos + tareas + vista del mesero + marcado delegado**: reescribe Tareas y Asignar.
4. **Desmontaje + inventario**: guard y regla nuevos, nav.
5. **Invitados Excel**: upload, encode, download, flags.
6. **Visor de auditoría + snapshot de inventario**: revisión por evento y por persona.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/core/models/dominio.models.ts` | Modified | Agrega `Cargo`, `MiembroEquipo`, `EntradaAuditoria`, `ArchivoInvitados` y `estado` inactivo. Quita `Participante`, `asignadoA`, `desmontajeAsignadoA` y los campos viejos de inventario |
| `src/app/core/services/*` | Modified/New | event, task e inventory se modifican; equipo, cargo, audit e invitados son nuevos; también user y auth |
| `src/app/core/guards/*` | Modified | inventario y rol; agrega el chequeo de inactivo |
| `src/app/page/eventos, tareas, tareas/asignar, inventario, admin/equipo` | Modified | Reescritura alrededor de equipo y cargos |
| `src/app/page/` (nuevas) | New | Detalle de evento (equipo y cargos), invitados, auditoría |
| `src/app/shared/nav-items.ts`, `src/app/app.routes.ts` | Modified | Rutas y links nuevos |
| `database.rules.json` | Modified | Reescritura completa |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Las reglas no se pueden testear con Karma; un lookup mal hecho abre o cierra accesos | High | Emulador de Firebase o checklist manual por rol y fase antes de cada deploy |
| Comportamientos de reglas sin verificar: `child(null)` cuando falta el puntero, validación por hoja en un PATCH multi-path a la raíz, `ts === now` vía REST | Med | Prueba en emulador en las fases 1 y 2 |
| La auditoría la escribe el cliente: un usuario técnico puede falsearla | Med | Aceptado a esta escala; para endurecerla harían falta Cloud Functions |
| El base64 pesa ~33% más; los GET de eventos podrían traer el blob | Low | Nodo `invitados` propio fuera de `eventos`, límite validado de ~1 MB |
| Los flags denormalizados (`portero`, `membresias`, `titularId`) pueden quedar desincronizados | Med | Siempre en un PATCH multi-path, con lógica en servicios testeados |
| Las tareas de otros cargos se pueden leer dentro del mismo evento | Low | Documentado; el filtro es de UI |
| Un inactivo conserva su cuenta de Auth | Low | Las reglas son el bloqueo real |
| El proyecto no está en git: rollback frágil | High | Inicializar git antes de aplicar |

## Rollback Plan

- Antes de cada deploy, guardar una copia del `database.rules.json` vigente y volver a desplegarla si algo falla.
- Datos: no hay migración. Revertir = borrar `eventos`, `membresias`, `inventario`, `invitados` y `auditoria`, y el campo `estado: inactivo` de los usuarios.
- Código: revertir por fase (requiere git).

## Dependencies

- Firebase CLI con emulador de RTDB, o un checklist manual acordado.
- Infraestructura de specs: mocks de `RtdbService` y `AuthService` para strict TDD.

## Success Criteria

- [ ] Un mesero solo lista y lee los eventos donde está en el equipo; la REST API le niega cualquier otro (verificado en emulador o a mano).
- [ ] Un mesero solo puede cambiar `estado` en las tareas de sus cargos.
- [ ] Un inactivo no puede loguearse ni ser elegido, y sus entradas de auditoría siguen visibles.
- [ ] Solo el titular de Desmontaje edita el inventario.
- [ ] El Portero, los elegidos o "todos" descargan el xlsx idéntico al original; el resto recibe 403.
- [ ] Cada asignación, marcado (incluido el delegado) y subida deja una entrada de auditoría que nadie puede editar ni borrar.
- [ ] El admin puede revisar un evento y ver, por persona, sus cargos, quién se los asignó y qué marcó.

## Open Questions

1. **Estado del inventario (decisión del usuario)**: ¿3 valores (`hay` / `queda poco` / `no hay`) o 2 checkboxes excluyentes (check = hay, X = no hay)?
2. Si el titular de Desmontaje no está registrado, ¿admin o jefe editan el inventario en su nombre, igual que con las tareas?
3. ¿Hay un solo cargo Desmontaje por evento? Se asume que sí: es el puntero `cargoDesmontajeId`.
4. Activar, inactivar o promover son acciones globales: ¿van a una auditoría global o alcanza con `estadoCambiadoPor/En` en el usuario?
