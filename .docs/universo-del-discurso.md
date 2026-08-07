# Universo del discurso — Milan

> Documento vivo. Adaptado del proyecto original (Protocol EventZ, multi-tenant) a una app
> dedicada a un único salón: Milan. Acá queda consolidado todo lo definido en las conversaciones
> de diseño.

## 1. Contexto del negocio

Salón de eventos Milan. Hay distintos tipos de evento, pero todos siguen el mismo flujo
operativo: el jefe de meseros reparte responsabilidades entre los meseros, cada evento requiere
montaje, servicio durante el evento y desmontaje al final (con conteo de inventario).

**Problema que resuelve la app**: el dueño tenía que repetir manualmente, evento tras evento,
quién hacía qué. La app delega esa coordinación: el administrador solo define roles, y es el
jefe de meseros quien reparte tareas día a día.

## 2. Visión del producto

Un solo negocio (Milan), para siempre. No hay ambición multi-tenant: la app está pensada,
construida y asegurada (reglas de Firebase) para un único salón. Esto simplifica el modelo de
datos (sin `venues/{venueId}`) y el onboarding (sin código de negocio ni invitación).

## 3. Roles del sistema

Tres roles, jerárquicos, viven en `usuarios/{uid}.rol`:

| Rol | Alcance |
|---|---|
| `administrador` (dueño) | Hereda todo lo de `jefe_mesero`, más: gestionar usuarios, aprobar solicitudes de ingreso, asignar/revocar roles, ver el salón completo (inventario, eventos, historial). |
| `jefe_mesero` | CRUD completo de tareas del evento, asigna tareas a los meseros activos. Cargo **no permanente**: el admin lo puede quitar o reasignar cuando quiera, pero no expira solo ni es por evento — se mantiene hasta que el admin lo cambie. |
| `mesero` | Ve solo sus tareas asignadas del evento activo, las marca como hecha/no hecha. No puede crear ni asignar tareas. |

**Importante**: "encargado de salón" y "encargado de inventario" **no son roles del sistema**.
Son tareas puntuales que el jefe de meseros (o el admin) asigna a un mesero para un evento dado.

## 4. Onboarding

Un solo camino de registro, sin invitación ni código de negocio: cualquiera se registra con
nombre, correo y contraseña, y queda creado en `usuarios/{uid}` con estado `pendiente` y sin
rol. Ve una pantalla de espera. El administrador ve la lista de solicitudes pendientes y asigna
el rol (`jefe_mesero` o `mesero`) — recién ahí el usuario entra con permisos reales.

**El primer administrador no se autoasigna**: se registra como cualquier usuario (queda
`pendiente`) y se promueve a mano, una única vez, desde la consola de Firebase Realtime
Database (`usuarios/{uid}`: `rol: "administrador"`, `estado: "activo"`). De ahí en más, todo el
resto del equipo se aprueba desde la app.

## 5. Eventos y activación

Cada evento es una entidad propia (`eventos/{eventoId}`) con fecha/horario.

**Decisión clave sobre "estar disponible"**: se descartó una ventana de tiempo genérica
(24 h desde que el mesero se activa, o franja fija 18:00–06:00) porque los eventos pueden
darse en días consecutivos y esas ventanas generan ambigüedad. En su lugar, la activación
está **atada al evento, no al reloj**: el mesero se marca disponible para un evento puntual
(`eventos/{eventoId}/participantes/{uid}: { activo: true }`), no "por X horas".

Esto además da gratis el historial pedido por el negocio: como todo queda anidado bajo el
evento, cada evento pasado archiva automáticamente quién estuvo activo y qué tareas tenía —
útil para revisar responsabilidades ante cualquier incidente, sin lógica de expiración/reset.

## 6. Tareas

- CRUD de tareas (crear, editar, eliminar) exclusivo de `administrador` y `jefe_mesero`.
- Título/tipo libre — no hay catálogo fijo predefinido.
- Se asignan a meseros activos del evento.
- El mesero solo ve sus tareas asignadas y las marca hecha/no hecha (checklist).
- Un mesero sin tareas asignadas todavía ve una lista vacía — estado normal, no rompe nada.
- Hay un tipo de tarea recurrente: **lavado** (mencionado explícitamente, puede vivir dentro
  de la sección de tareas o aparte).

### UI del jefe de meseros — 3 secciones

1. **Tareas**: crear/editar/eliminar tareas del evento.
2. **Asignar**: asignar tareas a meseros activos; muestra tareas pendientes/sin asignar; y un
   **% de carga de trabajo por mesero** (calculado según cantidad de tareas) para ayudar a
   repartir el trabajo de forma equilibrada.
3. **Equipo**: ve quiénes están activos para el evento.

## 7. Inventario / desmontaje

- El conteo de inventario se hace en el **desmontaje**, es decir **después** del evento (no
  antes de montar).
- Se asigna como una tarea más, a un mesero específico (admin o jefe de meseros la asignan).
- La pantalla de inventario de ese evento es **visible solo para quien tiene esa tarea
  asignada**. Ahí carga: nombre del ítem, cantidad, qué falta / qué no falta, nota opcional.
- El administrador revisa después lo cargado y lo confirma con un check.
- Sirve para generar la lista de compra de reposición.

## 8. Diseño / UX

- Paleta sobria: blanco, negro y dorado.
- Minimalista, muy intuitivo, sin elementos de más.
- **Mobile-first al máximo** — la app está pensada primero para el teléfono.
- Debe reflejar correctamente los 3 roles en la interfaz (cada rol ve solo lo que le corresponde).
- Branding: logo de Milan (`public/branding/logo-milan.png`), usado en login, registro, header
  e íconos/PWA.

## 9. Stack técnico

Ver [`plan.md`](./plan.md) para el detalle completo. Resumen: Angular 18 (standalone + SSR) +
Angular Service Worker (PWA instalable en Android/iOS) + Tailwind puro + Firebase (Auth +
Realtime Database, sin backend propio, proyecto Firebase propio y separado de otras apps) —
siguiendo el patrón ya probado en el proyecto de referencia `miCartera`
(`E:\Golden Panda\8) Programacion\miCartera\miCartera`). Sin notificaciones push por ahora.
