# Design: core-eventos

## Technical Approach

Evento -> Equipo -> Cargos -> Tareas, with the real permissions in `database.rules.json`. Everything still goes over REST through `RtdbService`. Every mutation is **one multi-path PATCH at the root** (`PATCH /.json`). That PATCH holds the domain change and its audit entry, and the client generates the pushIds. Domain logic lives in **pure functions** under `src/app/core/logica/` (numbering, permissions, portero flags, patch building, base64, push ids), so it can be unit tested without HTTP. Services stay thin: they read, call pure builders and send one PATCH. Pages follow container/presentational: one container per route and presentational children with `@Input/@Output`.

## Architecture Decisions

| # | Topic | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Atomicity | `PatchBuilder` + `RtdbService.patchRaiz(updates)` (PATCH `/.json`) | Sequential PATCHes (the old `TaskService.asignar`) | All-or-nothing writes. Each leaf is checked against its own rules. Denormalized flags can't drift. |
| D2 | Ids | Pure `generarPushId(now, rand)` using Firebase's algorithm (8 time chars + 12 random chars) | `POST` (server id), the current `generarId()` | Ids must exist before the PATCH. They sort by time, which audit ordering needs. Clock and random are injectable for tests. |
| D3 | Rule helpers | Expressions inlined in the JSON, copied from the canonical table below | A template plus a Node generator script; Bolt (deprecated) | RTDB rules have no functions. A generator adds a build step that someone will forget. The deployed file stays readable. |
| D4 | Jefe/admin event list | `GET eventos?shallow=true` for the keys, then `forkJoin` of `eventos/{eid}/info` | Full `GET eventos` (today's `listar()`); a separate `eventosIndice` node | No full-tree download and no extra denormalized node. N small GETs is fine at salon scale. |
| D5 | Mesero discovery | `GET membresias/{uid}` for the keys, then `forkJoin` of `eventos/{eid}/info` | `orderByChild` on `equipo` (rules don't filter queries, and a deep index isn't possible); read everything | This is the only way that works with `.read` restricted per event. |
| D6 | Inventory scope | Global per salon: `inventario/{itemId}` with `eventoId` = the event the edit happened under (it drives the permission). Soft delete with `archivado: true`. Full snapshot into the audit on finalize. | Per event (`eventos/{eid}/inventario`), which duplicates the list on every event; hard delete | The salon's stock is a single list. With soft delete, every write carries `newData.eventoId`, so one rule branch covers it (a delete has no `newData`). |
| D7 | Inventory `estado` | **PENDING USER DECISION.** Optional string field `estado?: EstadoInventario`. The values come from one constant `ESTADOS_INVENTARIO`, used by the UI and copied into the rule regex. | Booleans `hay` / `noHay` | Both options fit: 3 values (`hay\|queda_poco\|no_hay`), or 2 exclusive checkboxes (`hay\|no_hay`, with the field absent meaning unchecked). Switching means changing 1 constant and 1 regex. |
| D8 | Inactive users | (a) Every rule ANDs `ACTIVO`. (b) `usuarios/{uid}` stays readable by its owner. (c) `AuthService` finds `estado==='inactivo'` at login or refresh, calls `signOut` and `logout`, and throws the tuteo message. (d) `authGuard` requires `sesion.estado==='activo'`. (e) An HTTP interceptor catches a 401/403 from RTDB, runs `refrescarSesion()`, and logs out if the user is now inactive. | Rules only | Rules are the real lock. The client gives a clear message. Self-read is needed to tell "inactive" apart from "no profile". |
| D9 | Invitados blob | `invitados/{eid}/meta` (`nombreArchivo, tamano, subidoPor, subidoEn`) plus `invitados/{eid}/base64` | Flat node (proposal table) | REST `shallow` does not return primitive values, so to show the file name without downloading 1.4 MB, the metadata needs its own path. This is a small refinement of the proposal. |
| D10 | Base64 | No dependency. Upload: check `file.size <= 1_048_576`, then `FileReader.readAsDataURL`, then strip the `data:*;base64,` prefix. Download: `atob` -> `Uint8Array` -> `Blob(xlsx MIME)` -> `URL.createObjectURL` -> `<a download>` -> `revokeObjectURL`. Only when `isPlatformBrowser`. | SheetJS; Storage | Out of scope and no new services. Byte-identical round trip. |
| D11 | Legacy pages | Slice 2 **deletes** Tareas, Asignar, Inventario (pages, routes, guard, services). Slices 3 and 4 rebuild them from scratch. | Keep them alive by re-implementing `obtenerVigente` | Once slice 2's rules restrict `eventos`, those pages get 403. Keeping them alive means writing throwaway code. The DB has no events. **Tradeoff:** if the salon is working events, ship slices 2 and 3 in the same release. |
| D12 | Info edits | Always leaf paths (`eventos/E/info/nombre`), never a PUT of the whole `info` | PUT of `info` | A PUT would wipe `cargoDesmontajeId` and `invitadosTodos`. |
| D13 | "Users" vs "team" | Rename `page/admin/equipo` to `page/admin/usuarios`; route `/app/admin/usuarios`; nav label "Usuarios" | Keep "Equipo" | "Equipo" now means a single event's team. |

## RTDB Schema (final)

| Path | Fields (types) | Notes |
|---|---|---|
| `usuarios/{uid}` | `nombre, email, rol, estado: activo\|inactivo, creadoEn, estadoCambiadoPor?, estadoCambiadoEn?` | Admin-only change of `rol`/`estado` (global audit = Open Q) |
| `eventos/{eid}/info` | `nombre, fechaInicio, fechaFin` (`YYYY-MM-DDTHH:mm`), `estado: programado\|en_curso\|finalizado, cargoDesmontajeId?, invitadosTodos: bool, creadoPor, creadoEn` | ISO strings compare lexicographically |
| `eventos/{eid}/equipo/{mid}` | `nombre, registrado, portero, verInvitados` | `mid` = uid or `nr_{pushId}` |
| `eventos/{eid}/cargos/{cid}` | `nombre, tipo: mesero\|portero\|desmontaje\|libre, orden, titularId?` | |
| `eventos/{eid}/tareas/{tid}` | `titulo, cargoId, nota?, orden, estado: pendiente\|hecho` | |
| `membresias/{uid}/{eid}` | `true` | registered members only |
| `inventario/{itemId}` | `nombre, orden, estado?, notas, eventoId, actualizadoPor, actualizadoEn, archivado?` | |
| `invitados/{eid}/meta`, `/base64` | see D9 | |
| `auditoria/{eid}/{pushId}` | `accion, actorUid, paraMid?, objetivo, detalle?, ts` | append-only |

## Rules Strategy

**Canonical snippets** (copy them verbatim; `U(x)` = `root.child('usuarios/' + auth.uid + '/x').val()`):

| Name | Expression |
|---|---|
| `ACTIVO` | `auth != null && U(estado) === 'activo'` |
| `ADMIN` | `ACTIVO && U(rol) === 'administrador'` |
| `JEFE_O_ADMIN` | `ACTIVO && (U(rol) === 'administrador' \|\| U(rol) === 'jefe_mesero')` |
| `MIEMBRO` | `root.child('eventos/' + $eid + '/equipo/' + auth.uid).exists()` |
| `TITULAR_TAREA` | `root.child('eventos/' + $eid + '/cargos/' + data.parent().child('cargoId').val() + '/titularId').val() === auth.uid` (uses the PRE-state `cargoId`) |
| `TITULAR_DESM(e)` | `root.child('eventos/' + e + '/cargos/' + root.child('eventos/' + e + '/info/cargoDesmontajeId').val() + '/titularId').val() === auth.uid`, where `e = newData.child('eventoId').val()` |

Use string concatenation, not `child(null)`. A missing pointer becomes `.../cargos/null/...`, which is null and fails the comparison, so the rule denies (fails closed).

**Per node** (root: no `.read`, `.write: false`):

| Node | `.read` | `.write` | `.validate` (key points) |
|---|---|---|---|
| `usuarios` | `JEFE_O_ADMIN` | — | |
| `usuarios/$uid` | `auth.uid === $uid` (even if inactive) | `(auth.uid===$uid && !data.exists() && rol==='mesero' && estado==='activo') \|\| (ADMIN && auth.uid !== $uid)` | `rol` and `estado` from their enums; `estadoCambiadoPor === auth.uid`; `estadoCambiadoEn === now`; `$other: false` |
| `eventos` | `JEFE_O_ADMIN` (also enables shallow) | — | |
| `eventos/$eid` | `ACTIVO && MIEMBRO` | `JEFE_O_ADMIN && !newData.exists()` (delete only) | |
| `.../info` | — | `JEFE_O_ADMIN` | `fechaFin >= fechaInicio`; `estado` enum; `cargoDesmontajeId`: `newData.parent().parent().child('cargos/' + newData.val() + '/tipo').val() === 'desmontaje'` |
| `.../equipo/$mid` | — | `JEFE_O_ADMIN` | `registrado ? (!$mid.beginsWith('nr_') && root usuarios/$mid/estado === 'activo') : $mid.beginsWith('nr_')`; bools |
| `.../cargos/$cid` | — | `JEFE_O_ADMIN` | `tipo` enum; `tipo==='desmontaje'` ⇒ `newData.parent().parent().child('info/cargoDesmontajeId').val() === $cid` (one per event); `titularId` exists in `newData…equipo` |
| `.../tareas/$tid` | — | `JEFE_O_ADMIN` | `cargoId` exists in post-state `cargos`; `estado` enum |
| `.../tareas/$tid/estado` | — | `ACTIVO && TITULAR_TAREA` | enum. Only this leaf is granted, so the mesero can change `estado` and nothing else. |
| `membresias/$uid` | `ACTIVO && auth.uid === $uid` | — | |
| `membresias/$uid/$eid` | — | `JEFE_O_ADMIN` | `newData.val() === true` (hardening: `newData.parent().parent().parent().child('eventos/'+$eid+'/equipo/'+$uid).exists()`) |
| `inventario` | `ACTIVO` (not sensitive; jefe/admin supervise) | — | |
| `inventario/$id` | — | `ACTIVO && newData.exists() && TITULAR_DESM(e) && root…eventos/e/info/estado !== 'finalizado'` | `estado` regex from `ESTADOS_INVENTARIO`; `actualizadoPor === auth.uid`; `actualizadoEn === now` |
| `invitados/$eid` | `JEFE_O_ADMIN \|\| (ACTIVO && MIEMBRO && (equipo/uid/portero \|\| equipo/uid/verInvitados \|\| info/invitadosTodos))` | `JEFE_O_ADMIN` | `base64`: `isString() && length <= 1400000` (⌈1 MiB/3⌉·4 = 1,398,104); `meta.tamano <= 1048576`; `subidoEn === now` |
| `auditoria/$eid` | `JEFE_O_ADMIN` | — | |
| `auditoria/$eid/$aid` | — | `ACTIVO && !data.exists() && newData.exists() && (JEFE_O_ADMIN \|\| MIEMBRO)` | `actorUid === auth.uid`; `ts === now`; `accion.matches(/^[a-z_]+(\.[a-z_]+)+$/)` |

**Note on cascade:** `.read` and `.write` cascade down and can never be revoked further down. That is why there is no root `.read`, and why admin/jefe write access is granted per subnode, never at `eventos/$eid` (except for deletes).

**Access matrix** (R = read, W = write, — = denied):

| Resource | Admin | Jefe | Member titular | Member, not titular | Non-member | Inactive / anon |
|---|---|---|---|---|---|---|
| Event list | R all | R all | R own (membresias) | R own | — | — |
| `eventos/E` | RW | RW | R; W `estado` of own tasks | R | — | — |
| Inventory | R | R | RW if Desmontaje titular | R | R | — |
| Invitados | RW | RW | R if flag/portero/all | R if flag | — | — |
| Audit | R + append | R + append | append | append | — | — |

**UNVERIFIED (must be checked before deploying slices 1 and 2):**

| # | Behavior | Expected |
|---|---|---|
| V1 | Multi-path PATCH `/.json`: `.write` and `.validate` are evaluated per leaf, and `newData` reflects the full merged update (cross-path validates) | yes |
| V2 | A missing pointer (`cargos/null/titularId`) denies the write; it neither errors open nor allows | deny |
| V3 | `{".sv":"timestamp"}` nested inside a root PATCH via REST satisfies `ts === now` | pass |
| V4 | Ancestor `.validate` (`tareas/$tid`) runs on a leaf write to `estado` without breaking it | pass |
| V5 | `?shallow=true` on `eventos` needs `.read` at `eventos` (and gets it) | 200 for jefe, 403 for mesero |
| V6 | A PATCH whose paths overlap (one is an ancestor of another) is rejected | 400. `PatchBuilder` throws first |
| V7 | `.validate` on strings around 1.4M characters behaves correctly | 1,398,104 passes; 1,400,001 fails |

**How to verify:** add `"emulators": {"database":{"port":9000},"auth":{"port":9099}}` to `firebase.json`, then run `firebase emulators:start`. Create admin, jefe, mesero A (member), mesero B (non-member) and an inactive user in the Auth emulator, take their idTokens from the emulator's `signInWithPassword`, seed the data with `?auth=owner`, and run the manual REST checklist (curl/PowerShell `Invoke-RestMethod`): one row per matrix cell and per V1–V7, each with its expected status code. Record the results in `openspec/changes/core-eventos/rules-checklist.md` (the apply phase writes it). `@firebase/rules-unit-testing` was rejected for now: it needs a second Node runner outside Karma.

## Service Layer

Pure modules (new, `src/app/core/logica/`):

```ts
// patch-builder.ts
export type Updates = Record<string, unknown>;
export class PatchBuilder {
  constructor(private eid: string, private idGen: () => string) {}
  set(path: string, value: unknown): this;   // throws on ancestor/descendant overlap (V6)
  remove(path: string): this;                // value null
  audit(e: NuevaEntradaAuditoria): this;     // adds auditoria/{eid}/{idGen()}
  build(): Updates;
}
// auditoria.ts
export function crearEntradaAuditoria(e: NuevaEntradaAuditoria): EntradaAuditoriaPayload; // ts: {'.sv':'timestamp'}, strips undefined
export function agruparPorPersona(entradas: EntradaAuditoria[], equipo: MiembroEquipo[]): ResumenPersona[];
// push-id.ts       generarPushId(now = Date.now, rand = Math.random): string
// numeracion.ts    siguienteNombreMesero(cargos): string; siguienteOrden(items): number   // max+1, no renumbering
// permisos.ts      esJefeOAdmin(rol); puedeMarcar(sesion, cargo); esTitularDesmontaje(uid, evento);
//                  puedeVerInvitados(uid, rol, evento); flagsPortero(cargos, equipo): Record<mid, boolean>
// base64.ts        base64DesdeDataUrl(s); bytesDesdeBase64(b64): Uint8Array; tamanoMaximoOk(bytes)
```

| Service | Status | Methods (all mutations: `Observable<void>` = one `patchRaiz`) |
|---|---|---|
| `RtdbService` | Modify | +`patchRaiz(u: Updates)`, +`getShallow(path)`; −`push`, −`getByChild` (slice 1); −`put`/`remove` if unused (slice 6) |
| `AuthService` | Modify | Inactive check in `cargarPerfilYGuardar`/`refrescarSesion` (+`signOut`); −`mensajeError` (dead) |
| `UserService` | Modify | `listarUsuarios()`, `listarElegibles()` (active only), `asignarRol`, `cambiarEstado(uid, estado, adminUid)`; −`listarActivosPorRol` |
| `EventService` | Rewrite | `listarTodos()` (D4), `listarMios(uid)` (D5), `obtenerInfo(eid)`, `obtenerDetalle(eid)` (single GET of `eventos/E`), `crear`, `editar`, `borrar(evento, equipo)` (+ nulls `membresias/*/E` and `invitados/E`), `finalizar(evento, items?)` (slice 6 adds the snapshot), `reactivar` |
| `EquipoService` | New | `agregarRegistrado(eid, usuario)`, `agregarNoRegistrado(eid, nombre)`, `quitar(eid, miembro, cargos)` (nulls equipo, membresia, titularIds and recomputes portero), `cambiarVerInvitados` |
| `CargoService` | New | `crearMesero(eid, cargos)`, `crearPortero`, `crearLibre(nombre)`, `crearDesmontaje` (+pointer), `renombrar`, `asignarTitular(eid, cargo, mid\|null, detalle)` (+portero flags), `eliminar(eid, cargo, tareas, destino: cargoId\|null)` (moves or deletes tasks, nulls the pointer if desmontaje) |
| `TaskService` | Rewrite (slice 3) | `crear(eid, cargoId, titulo, nota?)`, `editar`, `mover`, `eliminar`, `marcar(eid, tarea, estado, cargo, actorUid)` (sets `paraMid` = titularId when actor ≠ titular) |
| `InventoryService` | Rewrite (slice 4) | `listar()`, `agregar(eid, datos)`, `editar(eid, item, cambios)`, `archivar(eid, item)`, `snapshot(items)` |
| `InvitadosService` | New (slice 5) | `obtenerMeta(eid)`, `descargar(eid)`, `subir(eid, file: File)`, `borrar(eid)`, `cambiarTodos(eid, bool)` |
| `AuditService` | New (slice 2) | `listar(eid)` sorted by key (pushId); the entries themselves are built by `PatchBuilder.audit` |

Example flow (assigning a titular):

```
CargoService.asignarTitular
  -> PatchBuilder(eid).set(cargos/C/titularId, mid)
       .set(equipo/X/portero, ...)            // from flagsPortero diff
       .audit({accion:'cargo.titular', ...})
  -> rtdb.patchRaiz(build())
```

## UI per Slice (mobile-first: cards and accordions, no columns)

| Slice | Routes / pages | Nav |
|---|---|---|
| 1 | `/app/admin/usuarios` (rename; role and active/inactive toggle; inactive users in a separate section). Login shows the inactive message. `authGuard` checks `estado`. `rolGuard` redirect goes to `/app/eventos`. | Admin: Eventos, Usuarios |
| 2 | `/app/eventos` (role-aware list). `/app/eventos/:eid` container `EventoDetalleComponent` with tabs; the **Equipo** tab (`EquipoEventoComponent`) has a selector of eligible users plus "Agregar sin cuenta" (name only). Non-registered members get a "Sin cuenta" badge. Create/edit/delete/finalize in a modal. Delete Tareas/Asignar/Inventario (D11). | Jefe: Eventos. Mesero: Mis eventos |
| 3 | **Cargos** tab (`CargosEventoComponent`): "+ Mesero / + Portero / + Desmontaje / + Otro", a titular select per cargo (warns if the titular is inactive), tasks inside the accordion. Jefe checkboxes = delegated marking, with a "Marcado por {actor} para {titular}" hint. Mesero sees **Mis tareas** (`MisTareasComponent`): only the cargos where `titularId === uid`. | — |
| 4 | `/app/eventos/:eid/inventario`, new `inventarioGuard(eid)`: admin/jefe (read only) or Desmontaje titular. Table becomes cards `# \| nombre \| estado \| notas`. Link from the detail page when allowed. | contextual link |
| 5 | **Invitados** tab: upload (jefe/admin), download, `invitadosTodos` toggle, a `verInvitados` toggle per member. Unauthorized users see "No tienes acceso a la lista de invitados". | — |
| 6 | `/app/eventos/:eid/auditoria` (`rolGuard('jefe_mesero')`): timeline view and per-person view (`agruparPorPersona`). Finalizing writes the inventory snapshot. Final sweep. | tab/link in detail |

## File Changes (KEEP / MODIFY / DELETE)

| File / symbol | Action | Slice |
|---|---|---|
| `database.rules.json` | Modify: S1 helpers + per-node `.read` (legacy `eventos/*` kept with `ACTIVO`); S2 replaces `eventos`, adds `membresias` and `auditoria`; S4 `inventario`; S5 `invitados` | 1–5 |
| `firebase.json` | Modify: emulators | 1 |
| `dominio.models.ts` `EstadoUsuario`, `Usuario` | Modify (+`inactivo`, `estadoCambiado*`) | 1 |
| `Participante`, `Evento.fecha/horaInicio/horaFin/desmontajeAsignadoA`, `Tarea.asignadoA/tipo/creadoPor/creadoEn`, `TipoTarea`, old `ItemInventario` | Delete | 2 |
| `Evento` (new shape), `MiembroEquipo`, `EntradaAuditoria`, `EventoDetalle` | Create | 2 |
| `Cargo`, `TipoCargo`, new `Tarea` | Create | 3 |
| `ItemInventario` (new), `EstadoInventario`, `ESTADOS_INVENTARIO` | Create | 4 |
| `ArchivoInvitadosMeta` | Create | 5 |
| `core/logica/*` + `*.spec.ts` | Create | 2 (patch, push-id, auditoria), 3 (numeracion, permisos), 5 (base64) |
| `rtdb.service.ts` | Modify (see table) | 1, 6 |
| `auth.service.ts` | Modify | 1 |
| `core/interceptors/sesion-inactiva.interceptor.ts`, `app.config.ts` | Create / Modify | 1 |
| `user.service.ts` | Modify | 1 |
| `event.service.ts` `listar`, `obtenerVigente`, `listarParticipantes`, `activarme`, `desactivarme`, `generarId` | Delete (rest rewritten) | 2 |
| `task.service.ts` (incl. `calcularCarga`, `CargaMesero`, `asignar`) | Delete in 2, re-create in 3 | 2/3 |
| `inventory.service.ts` (incl. `confirmarAdmin`) | Delete in 2, re-create in 4 | 2/4 |
| `equipo.service.ts`, `audit.service.ts` | Create | 2 |
| `cargo.service.ts` | Create | 3 |
| `invitados.service.ts` | Create | 5 |
| `guards/auth.guard.ts`, `rol.guard.ts` | Modify | 1 |
| `guards/inventario.guard.ts` | Delete in 2, re-create (eid-based) in 4 | 2/4 |
| `guards/inicio.guard.ts` | Keep | — |
| `page/admin/equipo/*` | Move to `page/admin/usuarios/*` | 1 |
| `page/eventos/eventos.component.*` (self-toggle, `participantesPorEvento`) | Modify (rewrite the list) | 2 |
| `page/eventos/detalle/**` (container + equipo) | Create | 2 (+3, 5 tabs) |
| `page/tareas/tareas.component.*`, `page/tareas/asignar/*` | Delete | 2 |
| `page/inventario/*` | Delete; new `page/eventos/inventario/*` | 2 / 4 |
| `page/eventos/auditoria/*` | Create | 6 |
| `app.routes.ts`, `shared/nav-items.ts` (`ICONO_ASIGNAR`, Tareas/Asignar entries) | Modify each slice; delete the entries in 2 | 1–6 |
| `shared/components/*` (badge, modal, layout, header, navs) | Keep | — |
| `register.component`, `login.component` | Keep / Modify (message only) | 1 |

**Slice 6 sweep:** search for `asignadoA|desmontajeAsignadoA|Participante|participantes|calcularCarga|obtenerVigente|TipoTarea|confirmadoPorAdmin|/app/tareas|generarId`. Remove unused `RtdbService` methods and dead icons. Expect zero hits.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit (Karma, pure) | `PatchBuilder` (overlap throws, audit path, nulls), `generarPushId` (ordering, length 20), `siguienteNombreMesero` (gaps → max+1), `flagsPortero`, `permisos`, `base64` round trip (fixed bytes), `agruparPorPersona` | Plain Jasmine, no TestBed |
| Unit (services) | The exact `Updates` object passed to `patchRaiz`; read composition (shallow + forkJoin) | `TestBed` with a `jasmine.createSpyObj<RtdbService>` that returns `of(...)`, an `AuthService` stub, and a fixed `idGen` |
| Guards / interceptor | inactive → logout; inventory guard per role | `TestBed.runInInjectionContext` |
| Rules | matrix + V1–V7 | Emulator plus the manual REST checklist, before each deploy |

**Order inside each slice:** (1) models and types; (2) pure-function specs RED, then GREEN; (3) service specs RED, then GREEN; (4) rules plus a checklist run in the emulator; (5) guards and routes; (6) presentational components, then the container; (7) delete the replaced code and fix nav; (8) manual mobile smoke test.

## Migration / Rollout

No data migration (the DB only has `/usuarios`). Before each deploy, back up `database.rules.json` and initialize git (the proposal lists this as a High risk). Slices 2 and 3 should ship together if the salon has live events (D11).

## Open Questions

- [ ] **PENDING USER DECISION:** inventory estado, 3 values or 2 exclusive checkboxes (D7)
- [ ] If the Desmontaje titular is not registered, can admin/jefe edit the inventory? (That is a one-line `|| JEFE_O_ADMIN` in the rule.)
- [ ] One Desmontaje per event (enforced by the rules: `tipo` ⇔ pointer)
- [ ] Global audit for role/estado changes, or only `estadoCambiadoPor/En`?
- [ ] After an event is deleted, its audit stays orphaned (readable by key only). Acceptable?
