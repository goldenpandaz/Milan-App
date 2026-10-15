# Tasks: core-eventos

Conventions: TDD = RED (Karma spec) -> GREEN -> REFACTOR. Pure logic in `src/app/core/logica/`. No task runs a build. Rules are not Karma-testable: each rules task has an emulator/REST checklist task (results in `openspec/changes/core-eventos/rules-checklist.md`). UI copy in tuteo, Spanish naming.
`[ASK]` = needs explicit user approval first. `[Q1]`..`[Q4]` = depends on open decision (default shown; block or default).

Open decisions: **Q1** inventory estado (default: 3 values `hay|queda_poco|no_hay`); **Q2** admin/jefe edit inventory if titular is unregistered (default: yes, per spec ASSUMED); **Q3** one Desmontaje per event (default: yes); **Q4** global audit for rol/estado (default: no, only `estadoCambiadoPor/En`).
Release note: if the salon runs live events, slices 2 and 3 MUST ship together (slice 2 deletes old Tareas/Asignar/Inventario, D11).

## Slice 0: Setup (before slice 1)

- [ ] 0.1 [ASK] Safety commit: ask the user before `git init` and the first commit (project is not under git). AC: user approved; conventional commit, no AI attribution.
- [ ] 0.2 `package.json`: add `@angular/fire` and `firebase` to dependencies (installed: 18.0.1 and 12.17.1). AC: FLAG major mismatch (@angular/fire 18 targets firebase 10/11); verify peerDependencies in `node_modules/@angular/fire/package.json` and whether `src/` imports either; decide with the user to keep, pin or remove.
- [ ] 0.3 `firebase.json`: add `"emulators": {"database":{"port":9000},"auth":{"port":9099}}`. AC: valid JSON, existing config untouched.
- [ ] 0.4 Create `src/app/testing/rtdb.service.mock.ts` (`jasmine.createSpyObj<RtdbService>` returning `of(...)`). AC: reusable factory.
- [ ] 0.5 Create `src/app/testing/auth.service.mock.ts` (sesion stub with uid, rol, estado). AC: reusable factory.
- [ ] 0.6 Copy current `database.rules.json` to `openspec/changes/core-eventos/backup/database.rules.original.json`. AC: identical copy exists before any rules edit.
- [ ] 0.7 Create `openspec/changes/core-eventos/rules-checklist.md` skeleton: emulator start, seed users (admin, jefe, mesero A member, mesero B non-member, inactive), idToken via `signInWithPassword`, `?auth=owner` seeding, rows for V1-V7 and matrix cells. AC: table with expected status per row, results column empty.

## Slice 1: Usuarios + reglas base

- [ ] 1.1 `dominio.models.ts`: `EstadoUsuario` +`inactivo`; `Usuario` +`estadoCambiadoPor?/En?`. AC: compiles by inspection.
- [ ] 1.2 RED `rtdb.service.spec.ts`: `patchRaiz` PATCHes `/.json`, `getShallow` adds `?shallow=true`. GREEN: add both in `rtdb.service.ts`. AC: specs pass.
- [ ] 1.3 Grep usages of `push`/`getByChild`; remove from `rtdb.service.ts` only if no callers, else defer to task 2.x deletions. AC: zero dangling refs.
- [ ] 1.4 RED `auth.service.spec.ts`: inactive profile at login/refresh -> `signOut`, logout, throws tuteo message; active passes. AC: fails first.
- [ ] 1.5 GREEN `auth.service.ts`: inactive check in `cargarPerfilYGuardar`/`refrescarSesion`; delete dead `mensajeError`. AC: 1.4 passes.
- [ ] 1.6 RED+GREEN `user.service.spec.ts` / `user.service.ts`: `listarUsuarios`, `listarElegibles` (active only), `asignarRol`, `cambiarEstado(uid, estado, adminUid)` writing `estadoCambiadoPor/En`; delete `listarActivosPorRol`. [Q4 default] AC: exact payload asserted.
- [ ] 1.7 RED+GREEN `core/interceptors/sesion-inactiva.interceptor.ts` (+spec): 401/403 from RTDB -> `refrescarSesion()`, logout if inactive. Register in `app.config.ts`. AC: spec passes.
- [ ] 1.8 RED+GREEN `guards/auth.guard.ts` (requires `estado==='activo'`) and `rol.guard.ts` (redirect `/app/eventos`), with specs. AC: inactive blocked.
- [ ] 1.9 `login.component`: show inactive message. AC: tuteo copy "Tu cuenta está inactiva, habla con el administrador".
- [ ] 1.10 `database.rules.json`: S1 helpers (ACTIVO/ADMIN/JEFE_O_ADMIN), remove root `.read`, `usuarios` rules per design, legacy `eventos/*` kept with ACTIVO. AC: valid JSON, matches design table.
- [ ] 1.11 Run checklist (emulator/REST) for `usuarios`, root GET 403, inactive 403, V1 and V2 where applicable; record in `rules-checklist.md`. AC: all rows pass.
- [ ] 1.12 [ASK] Deploy rules: confirm backup 0.6 exists, get explicit user approval, then deploy. AC: approval recorded.
- [ ] 1.13 Move `page/admin/equipo/*` to `page/admin/usuarios/*`; toggle activo/inactivo, inactive section; route `/app/admin/usuarios`; nav label "Usuarios" in `app.routes.ts`, `shared/nav-items.ts`. AC: old folder gone.
- [ ] 1.14 Manual mobile smoke test of login and user toggle. AC: noted in checklist.

## Slice 2: Eventos + equipo + auditoría

- [ ] 2.1 `dominio.models.ts`: create `Evento` (new), `MiembroEquipo`, `EntradaAuditoria`, `EventoDetalle`; delete `Participante`, old `Evento` fields, `Tarea.asignadoA/tipo/creadoPor/creadoEn`, `TipoTarea`, old `ItemInventario`. AC: models match schema.
- [ ] 2.2 RED+GREEN `core/logica/push-id.ts` (+spec): length 20, time ordering, injectable clock/rand.
- [ ] 2.3 RED+GREEN `core/logica/patch-builder.ts` (+spec): `set/remove/audit/build`, overlap throws (V6), audit path.
- [ ] 2.4 RED+GREEN `core/logica/auditoria.ts` `crearEntradaAuditoria` (+spec): `ts` = `{'.sv':'timestamp'}`, strips undefined.
- [ ] 2.5 RED+GREEN `event.service.ts` rewrite (+spec): `listarTodos` (shallow+forkJoin), `listarMios` (membresias), `obtenerInfo`, `obtenerDetalle`, `crear`, `editar` (leaf paths, D12), `borrar`, `finalizar`, `reactivar`; each sends one `patchRaiz` with audit. AC: exact `Updates` asserted.
- [ ] 2.6 RED+GREEN `equipo.service.ts` (+spec): `agregarRegistrado`, `agregarNoRegistrado`, `quitar`, `cambiarVerInvitados`. AC: removal nulls equipo, membresia, titularId.
- [ ] 2.7 Create `audit.service.ts` (+spec): `listar(eid)` sorted by key.
- [ ] 2.8 `database.rules.json`: S2 `eventos` subtree, `membresias`, `auditoria`. AC: matches design table.
- [ ] 2.9 Run checklist: matrix for eventos/membresias/auditoria, V1, V3, V4, V5, V6; record. AC: all pass.
- [ ] 2.10 [ASK] Deploy rules (backup first, explicit approval). Ship with slice 3 if live events.
- [ ] 2.11 UI: `page/eventos/eventos.component.*` role-aware list; create `page/eventos/detalle/**` (`EventoDetalleComponent` + `EquipoEventoComponent`, "Sin cuenta" badge); modal for create/edit/delete/finalize. AC: presentational/container split.
- [ ] 2.12 Delete: `page/tareas/tareas.component.*`, `page/tareas/asignar/*`, `page/inventario/*`, `guards/inventario.guard.ts`, `task.service.ts`, `inventory.service.ts`; in `event.service.ts` `listar`, `obtenerVigente`, `listarParticipantes`, `activarme`, `desactivarme`, `generarId`; routes and `ICONO_ASIGNAR`/Tareas/Asignar nav entries. Nav: Jefe "Eventos", Mesero "Mis eventos". AC: no references remain.
- [ ] 2.13 Manual mobile smoke test. AC: noted.

## Slice 3: Cargos + tareas + vista del mesero

- [ ] 3.1 `dominio.models.ts`: create `Cargo`, `TipoCargo`, new `Tarea`.
- [ ] 3.2 RED+GREEN `core/logica/numeracion.ts` (+spec): `siguienteNombreMesero` (gaps -> max+1), `siguienteOrden`.
- [ ] 3.3 RED+GREEN `core/logica/permisos.ts` (+spec): `esJefeOAdmin`, `puedeMarcar`, `esTitularDesmontaje`, `puedeVerInvitados`, `flagsPortero`.
- [ ] 3.4 RED+GREEN `cargo.service.ts` (+spec): crear mesero/portero/libre/desmontaje (+pointer) [Q3], `renombrar`, `asignarTitular` (+portero flags, audit `asignar`), `eliminar` (move/delete tasks).
- [ ] 3.5 RED+GREEN `task.service.ts` re-create (+spec): `crear/editar/mover/eliminar/marcar` (`paraMid` when actor != titular).
- [ ] 3.6 Rules checklist: titular marks `estado` only (200), other cargo/field 403, missing pointer denies (V2, V4), one Desmontaje [Q3]; rules adjusted in `database.rules.json` if gaps. [ASK] deploy.
- [ ] 3.7 UI: `CargosEventoComponent` tab (add buttons, titular select excluding inactive, delegated checkbox hint), `MisTareasComponent` (only cargos with `titularId===uid`). AC: filter scenario.
- [ ] 3.8 Update `app.routes.ts`; manual smoke test.

## Slice 4: Desmontaje + inventario

- [ ] 4.1 [Q1] `dominio.models.ts`: `ItemInventario` (new), `EstadoInventario`, `ESTADOS_INVENTARIO`. BLOCKED on Q1 or default 3 values.
- [ ] 4.2 RED+GREEN `inventory.service.ts` re-create (+spec): `listar`, `agregar`, `editar`, `archivar`, `snapshot`; audit each; [Q2] delegated edit sets `paraMid`.
- [ ] 4.3 [Q1][Q2] `database.rules.json` `inventario`: TITULAR_DESM, `estado` regex from constant, not finalized; `|| JEFE_O_ADMIN` only if Q2 yes and titular is `nr_`.
- [ ] 4.4 Rules checklist: titular 200; other mesero, jefe non-titular, no pointer 403; invalid estado rejected. [ASK] deploy.
- [ ] 4.5 RED+GREEN `guards/inventario.guard.ts` (eid-based, +spec).
- [ ] 4.6 UI `page/eventos/inventario/*` cards `# | nombre | estado | notas` [Q1]; contextual link in detail; route.

## Slice 5: Invitados

- [ ] 5.1 `dominio.models.ts`: `ArchivoInvitadosMeta`.
- [ ] 5.2 RED+GREEN `core/logica/base64.ts` (+spec): fixed-bytes round trip, `tamanoMaximoOk`.
- [ ] 5.3 RED+GREEN `invitados.service.ts` (+spec): `obtenerMeta`, `descargar`, `subir`, `borrar`, `cambiarTodos`; browser-only guard.
- [ ] 5.4 `database.rules.json` `invitados`; checklist V7 (1,398,104 ok, 1,400,001 fails), flags matrix. [ASK] deploy.
- [ ] 5.5 UI Invitados tab: upload, download, `invitadosTodos`, per-member `verInvitados`, no-access message.

## Slice 6: Auditoría + cierre

- [ ] 6.1 RED+GREEN `agruparPorPersona` in `auditoria.ts` (+spec).
- [ ] 6.2 `event.service.ts` `finalizar` writes inventory snapshot (+spec update).
- [ ] 6.3 UI `page/eventos/auditoria/*` (timeline + per person), `rolGuard('jefe_mesero')`, link in detail.
- [ ] 6.4 Remove unused `RtdbService.put/remove` and dead icons.
- [ ] 6.5 Final sweep: Grep `asignadoA|desmontajeAsignadoA|Participante|participantes|calcularCarga|obtenerVigente|TipoTarea|confirmadoPorAdmin|/app/tareas|generarId` in `src/`. AC: zero hits.
- [ ] 6.6 Final rules checklist pass of the full matrix; success criteria review.
