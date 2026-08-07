# Reglas de seguridad — Realtime Database

Archivo: `database.rules.json` (raíz del proyecto). Se aplican con `firebase deploy --only database`
una vez conectado el proyecto real de Firebase (Fase 8).

## Qué garantizan

- **Todo requiere autenticación.** Nada es legible ni escribible por un usuario anónimo, salvo
  `codigos_negocio` en lectura (ver más abajo por qué).
- **Aislamiento por negocio (multi-tenant).** Un usuario solo puede leer `venues/{venueId}` si
  figura como miembro de ese negocio puntual. No hay forma de leer datos de otro salón.
- **Bootstrap de "crear negocio"**: la creación de `info` y del primer usuario (administrador)
  solo se permite una vez, y solo si `duenoUid` coincide con quien está escribiendo — evita que
  cualquiera se autodeclare dueño de un negocio ajeno.
- **Alta como empleado**: un usuario puede crear su propio registro en `usuarios/{uid}` con
  `rol: null, estado: 'pendiente'` (default) o, si el negocio tiene
  `info.aprobacionAutomatica === true`, directamente con `rol: 'mesero', estado: 'activo'`. En
  ningún caso puede autoasignarse `jefe_mesero` ni `administrador` — eso lo valida la regla
  contra el valor real de `aprobacionAutomatica` en `venues/{venueId}/info`, no contra lo que el
  cliente diga. `info/aprobacionAutomatica` es el único campo de `info` con lectura pública,
  porque el formulario de alta necesita saber si puede saltear la espera ANTES de que la persona
  tenga una cuenta creada (todavía no es miembro del negocio en ese punto).
- **Gestión de roles**: solo quien ya es `administrador` de ese negocio puede modificar el rol o
  estado de otro usuario.
- **Eventos**: solo `administrador` o `jefe_mesero` pueden crear/editar eventos.
- **Tareas**: CRUD completo solo para `administrador`/`jefe_mesero`. Un mesero puede escribir
  su propia tarea asignada, pero la regla valida que solo cambie `estado` — si intenta tocar
  `titulo`, `tipo`, `asignadoA` o `creadoPor`, Firebase rechaza el write.
- **Inventario**: solo el administrador, o quien tenga el puntero `desmontajeAsignadoA` del
  evento apuntando a su uid, puede leer/escribir el inventario de ese evento. Ese puntero se
  actualiza automáticamente cuando se asigna una tarea de tipo `desmontaje`
  (`TaskService.asignar`) — así la regla no necesita recorrer todas las tareas del evento
  (Realtime Database no permite ese tipo de búsqueda dentro de una regla).
- **`confirmadoPorAdmin`**: solo el administrador puede ponerlo en `true`. Cualquier otro write
  debe mantenerlo en `false`.
- **`codigos_negocio` es de lectura pública** (`"​.read": true`) a propósito: el formulario de
  "ingresar como empleado" necesita poder validar el código ANTES de que la persona tenga una
  cuenta creada (todavía no está autenticada en ese punto). El valor expuesto es solo
  `código → venueId`, no otorga ningún acceso por sí mismo — el acceso real lo sigue dando el
  rol que asigna el administrador.

## Limitación conocida (aceptada para el MVP)

`usuarios_index/{uid}` es de escritura única (`!data.exists()`): un usuario queda ligado a un
solo negocio para siempre. No hay flujo para pertenecer a más de un salón o cambiarse de
negocio. Es coherente con el alcance actual ("inicialmente para mi negocio"); si más adelante
se vende a otros salones y una persona necesita pertenecer a varios, este índice hay que
rediseñarlo (lista de venues en vez de un único valor).

## Antes de ir a producción

Probar estas reglas con el **Rules Playground** de la consola de Firebase (o el simulador del
emulador local) contra los casos reales: alta de negocio, alta de empleado con código inválido,
mesero intentando reasignarse una tarea, mesero intentando ver el inventario sin tener la tarea
de desmontaje, etc. Las reglas de RTDB son difíciles de testear "a ojo" — vale la pena simular
antes de confiar en ellas con datos reales.
