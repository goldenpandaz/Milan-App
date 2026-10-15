# Exploration: puestos-por-evento

## Requirement
Hoy `Tarea.asignadoA` apunta directo a un uid. El flujo real (planilla de WhatsApp): las columnas son PUESTOS (Portero, Mesero 1..N), cada uno con su lista de tareas (algunas con nota de momento: "después 10 pm", "inicio fiesta"). Jefe/admin crean puestos y tareas primero, asignan tareas a puestos y, en un paso posterior, mapean cada puesto a una persona (una persona puede cubrir varios puestos). Los puestos son dinámicos por evento: botón "+ Mesero" (autonumerado), "+ Portero"/nombre libre, removibles. `responsableUid` es null hasta asignar. El mesero ve el checklist de todas las tareas de todos sus puestos.

## Current State
- `core/models/dominio.models.ts`: `Tarea.asignadoA` (uid), `Evento.desmontajeAsignadoA` (uid, en `eventos/{id}/info`), `Participante` en `eventos/{id}/participantes/{uid}`.
- RTDB: tareas planas en `eventos/{id}/tareas`. Todas las pantallas hacen GET one-shot y recargan (`cargar()`); sin listeners.
- Vista mesero: `tareas.component` filtra `asignadoA === uid` solo en cliente.
- Asignar: modos "Por tarea" y "Mi equipo"; `TaskService.calcularCarga` calcula % por uid; "Desasignar todas" pone `asignadoA` en null.
- Desmontaje: `TaskService.asignar` hace PATCH a la tarea y un segundo PATCH a `info.desmontajeAsignadoA` (no atómico).
- Inventario: `inventarioGuard` deja pasar al admin o a `evento.desmontajeAsignadoA === uid`; las reglas de `inventario` validan el mismo puntero.
- Reglas: `.read` global para cualquier usuario registrado (el filtro del mesero es solo UI). `tareas.write`: admin/jefe, o el uid asignado mientras `asignadoA`, `titulo`, `tipo`, `creadoPor` no cambien. `participantes` escribible por el propio usuario, admin o jefe.
- Tests: solo `app.component.spec.ts`. Las reglas no se pueden testear con Karma.

### Quirks existentes
- RTDB descarta nulls: `asignadoA: null` nunca se guarda (llega `undefined`). `responsableUid` debe tiparse `responsableUid?: string | null`.
- `/app/inventario` no tiene entrada en `nav-items.ts` (solo por URL).
- `EventService.listar()` baja todo el árbol `eventos` solo para leer `info`; lo usan `obtenerVigente()` y el guard.
- `obtenerVigente()` ordena por fecha descendente y toma el primero no finalizado: es el más lejano, no el más cercano como dice el comentario.
- Dos tareas de desmontaje se pisan en el puntero único.

## Affected Areas
- `core/models/dominio.models.ts`: agregar `Puesto { id, nombre, orden, responsableUid? }`; `Tarea` gana `puestoId?`, `nota?`, `orden?`; `asignadoA` y `desmontajeAsignadoA` quedan deprecados.
- `core/services/task.service.ts`: `crear` recibe `puestoId` y `nota`; `asignar` pasa a mover tarea entre puestos; se elimina el segundo PATCH; `calcularCarga` suma por persona a través de sus puestos.
- Nuevo `core/services/puesto.service.ts`: listar, crear (autonumerado "Mesero N" o nombre libre), renombrar, `asignarResponsable`, eliminar (mover o desvincular tareas), `desasignarTodos`. Usar PATCH multi-path sobre `eventos/{id}` para atomicidad.
- `core/services/event.service.ts`: leer `info` sin bajar todo el árbol.
- `core/guards/inventario.guard.ts`: resolver el responsable del puesto de desmontaje.
- `page/tareas/*`: agrupar por puesto, botones "+ Mesero"/"+ Portero", eliminar puesto con modal, selector de puesto y nota en el form, vista mesero = unión de sus puestos; en mobile acordeones/tarjetas, no columnas.
- `page/tareas/asignar/*`: reescritura. Modos "Por puesto" y "Por persona"; carga = suma por persona; "Desasignar todas" limpia `responsableUid`; aviso si el responsable está inactivo.
- `page/eventos/*`: opcional "N puestos / M sin responsable".
- `shared/nav-items.ts`: etiquetas y posible link condicional a Inventario.
- `database.rules.json`: nodo `puestos/$puestoId` (write admin/jefe, validar nombre/orden/responsableUid); regla de tarea del mesero con lookup a `puestos/{data.puestoId}/responsableUid === auth.uid`, `puestoId` y `nota` inmutables; regla de inventario (ver abajo); rama legacy `asignadoA` temporal.
- Specs nuevos: `puesto.service`, `task.service`, `inventario.guard`.
- Verificar que `rolGuard('jefe_mesero')` deje pasar también al admin (no se leyó `rol.guard.ts`).

## Desmontaje e inventario
- Las reglas no pueden iterar tareas: se necesita un puntero. Recomendado `info/desmontajePuestoId` (id de puesto, no uid).
- Regla de inventario: `admin || puestos/{desmontajePuestoId}/responsableUid === auth.uid` (doble lookup). Cambiar el responsable no requiere resync; solo crear/mover/borrar la tarea de desmontaje actualiza el puntero, en un PATCH multi-path atómico.
- Límite: un solo puesto de desmontaje por evento (igual que hoy).
- Sin verificar: `child(null)` con puntero ausente debería denegar; requiere emulador de Firebase.
- Variante B: mantener `desmontajeAsignadoA` (uid) resincronizado en 4 puntos (asignar responsable, mover tarea, borrar tarea/puesto, desasignar todos).
- El guard es solo conveniencia de UI; las reglas son la protección real.

## Migración de datos existentes
No hay acceso a la base real; se desconoce si tiene datos de producción o solo de prueba.
- Con datos reales: script idempotente por evento: un puesto por cada uid distinto en `asignadoA` (con `responsableUid = uid`), `puestoId` en cada tarea, tareas sin asignar quedan "Sin puesto", `desmontajePuestoId` al puesto con la tarea de desmontaje, borrar campos viejos al final (probar en copia).
- Eventos finalizados: lectura tolerante (tarea con `asignadoA` y sin `puestoId` va a un puesto virtual); reglas con rama legacy hasta confirmar migración.
- Solo datos de prueba: borrar `eventos/*` y empezar limpio.

## Approaches
1. **A. Puestos planos + `tarea.puestoId`, permisos por lookup (fuente única de verdad)** — Esfuerzo medio-alto. Pros: el responsable vive solo en el puesto; reasignar es 1 write; una persona con varios puestos no requiere fan-out; mover tarea es 1 campo; plantillas futuras en un write multi-path. Contras: doble lookup en reglas (complejo, sin tests); el guard hace un GET extra; reescritura de Asignar; requiere migración.
2. **B. Mismo modelo, manteniendo `desmontajeAsignadoA` (uid) sincronizado** — Esfuerzo medio. Pros: guard y regla de inventario intactos. Contras: 4 puntos de sync; inconsistencia si falla un write.
3. **C. Fan-out: el puesto escribe `asignadoA` en cada tarea** — Esfuerzo bajo-medio, deuda alta. Pros: mínimo cambio en reglas y vistas. Contras: duplica la verdad; N writes por asignación; deriva; encaja mal con "crear primero, asignar después".

## Recommendation
Approach A, por fases (cada una testeable con strict TDD):
1. Modelo, `PuestoService`, `TaskService` (lógica pura, cubrible en Karma).
2. Reglas, verificadas con emulador o checklist manual.
3. Página Tareas agrupada por puesto + vista del mesero.
4. Reescritura de Asignar.
5. Guard de inventario + migración/limpieza.
Fallback si preocupa el doble lookup: B. C no recomendado. Plantillas fuera de alcance (el modelo queda listo).

### Decisiones de producto (defaults sugeridos)
- Borrar puesto con tareas: pedir confirmación; mover tareas o dejarlas sin puesto. No renumerar (borrar Mesero 2 deja 1, 3, 4).
- Autonumerado: max N + 1 en cliente (carrera entre dos jefes tolerable).
- Un responsable por puesto; una persona puede tener varios puestos.
- Nota de momento: texto libre opcional.
- Responsable que pasa a inactivo: no se limpia solo; se muestra aviso.
- Copy de UI: solo tuteo.

## Risks
- Reglas sin tests automatizados: un lookup mal hecho puede abrir/cerrar acceso a inventario o tareas.
- Lecturas globales: el filtro del mesero es cosmético (preexistente, fuera de alcance).
- Escrituras compuestas con PATCH multi-path: verificar que las reglas validen cada hoja.
- Migración con datos desconocidos: tareas huérfanas o inventario bloqueado.
- El GET completo de `eventos` engorda con los puestos y el guard lo dispara en cada visita.
- `obtenerVigente()` puede elegir el evento equivocado.
- Un único puntero de desmontaje se rompe si el flujo real necesita varios puestos de desmontaje.
- Responsables inactivos dejan puestos huérfanos.
- Strict TDD requiere infraestructura de specs (mocks de `RtdbService` y `AuthService`) en el primer batch.
- Inventario sigue sin link en la nav.
- Layout tipo planilla en columnas no entra en mobile.

## Ready for Proposal
Sí, tras confirmar si la RTDB actual tiene datos reales a migrar o solo de prueba.
