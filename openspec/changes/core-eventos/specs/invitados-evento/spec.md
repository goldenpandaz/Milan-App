# Invitados del evento Specification

> **Revisión 5 (2026-10-15, rediseño; reemplaza la versión anterior entera).** La lista ya no se guarda como un .xlsx en base64 sin leer: el admin sube el .xlsx, **la app lo lee en el navegador** (librería cliente, sin backend ni servicios externos) y guarda **cada invitado como un registro** en la RTDB. La lista la manejan el admin, el jefe y quienes tengan en el evento un **cargo con el permiso "maneja la lista de invitados"**. Se eliminan los flags `portero`, `verInvitados` e `invitadosTodos`, la ventana de 10 minutos del mesero y la figura especial "Portero".

## Purpose

Sección "Invitados" del detalle del evento: subir la lista desde un .xlsx (solo admin), verla por mesas o completa, buscar por nombre, marcar y desmarcar asistencia ("chulear") con contadores, y re-subir una versión corregida sin perder las marcas. Datos en `invitados/{eid}/meta` y `invitados/{eid}/lista/{gid}` (nodo propio fuera de `eventos`, para que leer el evento no traiga la lista). No confundir con `info.personas` (cantidad de invitados para la sugerencia de meseros, ver `configuracion-meseros`).

## Modelo

- `invitados/{eid}/meta`: `nombreArchivo`, `total` (invitados no removidos), `subidoPor`, `subidoEn`.
- `invitados/{eid}/lista/{gid}`: `nombre` (como quedó tras normalizar espacios), `nombreNorm` (clave de búsqueda y de fusión: sin tildes, minúsculas, espacios simples), `mesa` (texto del título, p. ej. `MESA 5`; ausente = sin mesa), `orden` (posición en el archivo), `asistio` (bool), `asistioPor?` / `asistioEn?` (quién y cuándo cambió la marca por última vez, también al desmarcar), `auditId?` (entrada de auditoría de la última marca), `removido?` (true = ya no está en la lista vigente pero conserva su asistencia).
- Volumen esperado: ~100 a 300 invitados por evento. Límite de la app: **500 invitados** (`MAX_INVITADOS`) y archivo de **1 MiB** como máximo.

## Requirements

### Requirement: Permiso por cargo

Un cargo del catálogo MAY tener el permiso `manejaInvitados` ("maneja la lista de invitados"), que se copia en el snapshot del cargo al asignarlo en el evento (ver `catalogo-cargos` y `cargos-tareas`). Pueden ver y manejar la lista de un evento: el admin, el jefe y el **titular de un cargo del evento con `manejaInvitados = true`** ("titular de lista"). Si ningún cargo del evento tiene el permiso, solo la ven admin y jefe. Para que las reglas lo puedan comprobar sin recorrer cargos, el miembro guarda un puntero `equipo/{mid}/cargoInvitadosId` = `cid` de uno de sus cargos con el permiso; el puntero se recalcula en el mismo PATCH al asignar, cambiar o quitar un titular, o al cambiar el permiso de un cargo del evento, y las reglas vuelven a verificar al leer que ese cargo exista, tenga el permiso y siga teniendo a esa persona como titular (un puntero viejo no da acceso). "Portero" no tiene nada especial: es un cargo más, con o sin el permiso.

#### Scenario: Cargo con permiso
- GIVEN el cargo `Recepción` del catálogo con `manejaInvitados = true`
- WHEN el jefe se lo asigna a Ana en el evento
- THEN el snapshot del cargo tiene `manejaInvitados = true`, `equipo/Ana/cargoInvitadosId` apunta a él y Ana ve la sección Invitados desde 1 h antes del inicio

#### Scenario: Ningún cargo con permiso
- GIVEN un evento sin cargos con `manejaInvitados`
- WHEN un trabajador miembro abre el detalle
- THEN no ve la sección Invitados y leer `invitados/{eid}/lista` le da 403

#### Scenario: Pierde el cargo
- GIVEN Ana titular de `Recepción` (con permiso)
- WHEN el jefe le quita el cargo
- THEN en el mismo PATCH se borra su `cargoInvitadosId` y, aunque quedara un puntero viejo, las reglas le niegan la lista

#### Scenario: Puntero falso
- GIVEN un miembro sin cargo con permiso
- WHEN un jefe intenta escribir su `cargoInvitadosId` apuntando a un cargo del que no es titular o sin el permiso
- THEN la escritura se rechaza

### Requirement: Ventana de acceso a la lista

El admin MUST poder ver la lista en cualquier momento. El jefe y los titulares de lista MUST poder verla **desde 1 hora antes del inicio** (`inicioTs − 1 h`) **hasta que el evento se finalice** (fin + 4 h). Durante un evento reabierto (`reabierto`, solo admin) el jefe MUST mantener el acceso; los titulares de lista MUST NOT (igual que los meseros con las tareas). Las reglas MUST hacer cumplir la ventana con `now`. `meta` (nombre del archivo y total) MAY leerse sin ventana por admin, jefe y titulares de lista, para mostrar "Lista cargada: 107 invitados · disponible desde las 19:00". El resto MUST recibir 403.

#### Scenario: Jefe una hora antes
- GIVEN un evento que empieza a las 20:00
- WHEN el jefe abre la lista a las 18:59 y a las 19:00
- THEN a las 18:59 recibe 403 (la UI dice "Podrás ver la lista desde las 19:00") y a las 19:00 la ve

#### Scenario: Titular de lista
- GIVEN un titular de lista y faltan 50 minutos para el inicio
- WHEN abre la lista
- THEN la ve y puede marcar asistencia

#### Scenario: Evento finalizado
- GIVEN un evento finalizado (no reabierto)
- WHEN el jefe o un titular de lista leen la lista
- THEN reciben 403; el admin la sigue viendo

#### Scenario: Reabierto
- GIVEN un evento finalizado que el admin reabrió
- WHEN el jefe y un titular de lista abren la lista
- THEN el jefe la ve y marca; el titular recibe 403

#### Scenario: Trabajador sin permiso
- GIVEN un miembro sin cargo con permiso
- WHEN lee `invitados/{eid}/lista` o `invitados/{eid}/meta`
- THEN recibe 403

### Requirement: Subida y lectura del archivo

Solo el admin MUST poder subir la lista, en cualquier momento (antes, durante o después del evento). La app MUST leer el .xlsx en el navegador con una librería cliente (sin backend ni servicios externos), MUST NOT guardar el archivo original y MUST guardar cada invitado como un registro. Antes de escribir, la app MUST mostrar una **previsualización**: total de invitados, conteo por mesa (en el orden del archivo, "Sin mesa" al final si hay) y los avisos del parseo; el admin MUST confirmar ("Subir 107 invitados") o cancelar. La subida MUST ser un único PATCH con `meta`, todos los registros y la entrada `invitados.subir` (detalle: nombre del archivo, total y conteo por mesa). Al borrar el evento, `invitados/{eid}` MUST borrarse con él. El admin MAY borrar la lista entera (`invitados.borrar`).

#### Scenario: Subida válida
- GIVEN un admin y el archivo "ASISTENTES EVENTO NATHALIA.xlsx" (una hoja, columna A, ~107 personas en 11 mesas)
- WHEN lo elige
- THEN ve la previsualización con 107 invitados, `MESA PRINCIPAL` y `MESA 1` a `MESA 10` con su conteo, y al confirmar existen `meta`, 107 registros con `asistio = false` y una entrada `invitados.subir`

#### Scenario: Cancelar
- GIVEN la previsualización abierta
- WHEN el admin cancela
- THEN no se escribe nada

#### Scenario: Jefe o trabajador sube
- GIVEN un jefe o un trabajador
- WHEN escribe `invitados/{eid}/meta` o crea un registro en `lista`
- THEN recibe 403 y en la UI no ve "Subir lista"

#### Scenario: Archivo grande o lista enorme
- GIVEN un archivo de más de 1 MiB o con más de 500 invitados
- WHEN el admin lo elige
- THEN la app lo rechaza antes de escribir con "El archivo es demasiado grande" o "La lista supera el máximo de 500 invitados"

### Requirement: Reglas del parser

La función pura `parsearListaInvitados(filas)` recibe las filas de la **primera hoja** como arreglos de celdas y MUST aplicar, en este orden:

1. **Formato con encabezados**: si la primera fila con texto tiene una celda cuyo texto normalizado es `nombre` (y opcionalmente otra `mesa`), cada fila siguiente es un invitado con el texto de la columna `nombre` y la mesa de la columna `mesa` (vacía = sin mesa).
2. **Formato por bloques** (el caso real): se lee la **columna A**. Una celda cuyo texto, tras quitar espacios al principio y al final, **empieza con "MESA"** (sin importar mayúsculas ni tildes) abre una mesa nueva con ese texto como título (`MESA 5 ` → `MESA 5`). Cada otra celda con texto es un invitado de la mesa actual. Las filas vacías se ignoran (entre grupos puede haber 0 a 3; un título puede venir pegado al último nombre del grupo anterior). Los nombres que aparecen antes del primer título quedan sin mesa.
3. **Lista simple**: si no hay ningún título de mesa, todos los invitados quedan con mesa vacía (null).

Normalización: `nombre` = trim + espacios múltiples a uno (conserva mayúsculas y tildes del archivo); `nombreNorm` = lo anterior sin tildes (NFD sin diacríticos) y en minúsculas. Casos borde:

- **Duplicados**: el mismo `nombreNorm` dos veces (en la misma mesa o en otra) MUST conservarse como dos invitados y MUST mostrarse como aviso "Posible duplicado: {nombre} (MESA 3 y MESA 7)"; la app no deduplica sola (pueden ser homónimos).
- **Celdas no-texto** (números, fechas, booleanos, errores): MUST ignorarse y listarse como aviso con su número de fila. Una fórmula cuenta por su valor calculado.
- **Mesa vacía** (título sin nombres debajo): aviso "MESA 3 no tiene invitados"; no se guarda nada para ella (las mesas salen de los invitados).
- **Nombre de más de 120 caracteres**: se ignora con aviso.
- **Otras hojas o columnas con datos**: se ignoran con aviso ("Se leyó solo la hoja {nombre}", "Se ignoraron datos fuera de la columna A").
- **Hoja vacía o sin invitados**: error "El archivo no tiene invitados"; no se puede confirmar.
- **Archivo corrupto, protegido con contraseña o que no es .xlsx** (incluidos .xls, .csv renombrados): error claro "No pudimos leer el archivo. Verifica que sea un Excel (.xlsx)"; no se escribe nada.

#### Scenario: Título con espacios y sin fila vacía
- GIVEN la columna A con `...`, `Laura Gómez`, `MESA 7`, `Pedro Ruiz` (sin fila vacía antes de `MESA 7`) y otra celda `MESA 5 `
- WHEN se parsea
- THEN `Laura Gómez` queda en la mesa anterior, `Pedro Ruiz` en `MESA 7` y `MESA 5 ` se guarda como `MESA 5`

#### Scenario: Lista sin mesas
- GIVEN un archivo con 40 nombres y ningún título `MESA`
- WHEN se parsea
- THEN hay 40 invitados sin mesa y la vista "Por mesa" los muestra en un solo grupo "Sin mesa"

#### Scenario: Con encabezados
- GIVEN un archivo con encabezados `Nombre` y `Mesa` en la fila 1
- WHEN se parsea
- THEN cada fila es un invitado con la mesa de su columna

#### Scenario: Nombres con espacios de más
- GIVEN la celda `  José   Pérez `
- WHEN se parsea
- THEN `nombre = "José Pérez"` y `nombreNorm = "jose perez"`

#### Scenario: Archivo inválido
- GIVEN un .pdf renombrado a .xlsx
- WHEN el admin lo elige
- THEN ve "No pudimos leer el archivo. Verifica que sea un Excel (.xlsx)" y no se escribe nada

### Requirement: Re-subida con conservación de marcas

Si ya hay una lista, subir otra MUST **fusionarla** (no reemplazarla a ciegas) con la función pura `fusionarLista(actuales, nuevos)`, partiendo de una lectura fresca de la lista justo antes de escribir:

1. **Por nombre y mesa**: cada invitado nuevo se empareja con un registro actual (incluidos los `removido`) con el mismo `nombreNorm` y la misma mesa normalizada; si hay varios iguales, se emparejan en orden de `orden`.
2. **Por nombre único** (la mesa cambió): entre los que quedaron sin pareja, si el `nombreNorm` aparece **una sola vez** entre los actuales sin pareja y una sola vez entre los nuevos sin pareja, se emparejan.
3. Emparejado: conserva su `gid`, `asistio`, `asistioPor/En` y `auditId`; se actualizan `nombre`, `mesa`, `orden` y se quita `removido`. Las escrituras tocan solo esas hojas (nunca las de asistencia), para no pisar una marca hecha mientras tanto.
4. Nuevo sin pareja: registro nuevo con `asistio = false`.
5. Actual sin pareja **con** `asistio = true`: se conserva con `removido = true` (no se pierde el historial de asistencia; ASSUMED, pending user confirmation, Q20). Se muestra aparte ("Llegaron pero ya no están en la lista") y no cuenta en los totales.
6. Actual sin pareja **sin** asistencia: se borra.

La previsualización de una re-subida MUST mostrar además el resumen de la fusión (conservan su marca, nuevos, removidos con marca, borrados). Todo MUST ir en un PATCH con `meta` y la entrada `invitados.reemplazar` con ese resumen.

#### Scenario: Corrección con el evento empezado
- GIVEN una lista con `Ana Ruiz` (MESA 2) marcada como llegada
- WHEN el admin sube una versión corregida donde `Ana Ruiz` sigue en MESA 2 y se agregan 3 nombres
- THEN `Ana Ruiz` conserva su marca (mismo `gid`), hay 3 registros nuevos sin marca y una entrada `invitados.reemplazar`

#### Scenario: Cambió de mesa
- GIVEN `Luis Pardo` (MESA 4) marcado y único en ambas listas
- WHEN la nueva lista lo pone en MESA 6
- THEN conserva su marca y queda en MESA 6

#### Scenario: Homónimos que cambian de mesa
- GIVEN dos `Juan Díaz` (MESA 1 y MESA 3) y en la nueva lista dos `Juan Díaz` en MESA 2 y MESA 5
- WHEN se fusiona
- THEN no se emparejan por nombre (no es único): se crean dos nuevos sin marca, los viejos marcados quedan `removido` y los no marcados se borran; la previsualización lo avisa

#### Scenario: Desaparece alguien que ya llegó
- GIVEN `Marta Gil` marcada como llegada
- WHEN la nueva lista no la incluye
- THEN queda con `removido = true` y su marca, fuera de los totales, y la auditoría registra el caso

### Requirement: Funciones de la lista

La sección MUST ofrecer: vista **por mesas** (agrupada en el orden del archivo, "Sin mesa" al final), vista **de todos** (orden alfabético por `nombreNorm`), **búsqueda/filtro por nombre** que ignora tildes y mayúsculas (sobre `nombreNorm`, coincidencia parcial), **marcar/desmarcar asistencia** con un toque, y **contadores** "llegaron / total" global y por mesa (sin contar los `removido`). Descargar la lista no es el objetivo principal: MAY ofrecerse "Exportar" (genera un .xlsx en el navegador con nombre, mesa y asistencia; opcional).

#### Scenario: Buscar sin tildes
- GIVEN la invitada `María José Peña`
- WHEN el titular de lista escribe "maria jose pena"
- THEN aparece en el resultado

#### Scenario: Contadores
- GIVEN MESA 3 con 10 invitados y 4 marcados, y 107 en total con 30 marcados
- WHEN se abre la vista por mesas
- THEN MESA 3 muestra "4 / 10" y el encabezado "30 / 107"

### Requirement: Marcado de asistencia

Admin, jefe y titulares de lista MUST poder marcar y desmarcar la asistencia de cada invitado dentro de su ventana (admin siempre; jefe desde inicio − 1 h mientras el evento sea editable; titular de lista desde inicio − 1 h hasta fin + 4 h). **Esta ventana es la de la lista, no la de marcado de tareas** (inicio a fin + 2 h): los invitados llegan antes del inicio y la lista se sigue usando tras el horario (decisión explícita, ver D27 del design). Cada marca MUST ser un único PATCH por invitado que escribe `asistio`, `asistioPor` (= auth.uid), `asistioEn` (= hora del servidor), `auditId` y la entrada `invitado.asistencia` (`objetivo = gid`, detalle con el valor nuevo y el nombre). Para el titular de lista (no jefe/admin) las reglas MUST exigir el acople marca ↔ auditoría, como en las tareas. Varios usuarios MUST poder marcar a la vez invitados distintos sin conflictos (cada invitado es un path propio); sobre el mismo invitado gana la última escritura y ambas quedan auditadas. Nadie salvo el admin MUST poder crear, borrar o renombrar invitados ni cambiar su mesa. Marcar asistencia MUST NOT escribir `eventos/{eid}/actividad` mientras la duda Q19 siga abierta.

#### Scenario: Chulear
- GIVEN un titular de lista con el evento por empezar en 30 minutos
- WHEN marca a `Ana Ruiz`
- THEN `asistio = true`, `asistioPor` = su uid, `asistioEn` del servidor y hay una entrada `invitado.asistencia`

#### Scenario: Dos personas a la vez
- GIVEN el jefe y un titular de lista marcando invitados distintos al mismo tiempo
- WHEN envían sus PATCH
- THEN ambos se aplican

#### Scenario: Marca sin auditoría
- GIVEN un titular de lista
- WHEN cambia `asistio` por la REST sin la entrada de auditoría
- THEN recibe 403

#### Scenario: Titular intenta editar un invitado
- GIVEN un titular de lista o el jefe
- WHEN cambia `nombre` o `mesa`, o crea o borra un registro
- THEN recibe 403

#### Scenario: Fuera de ventana
- GIVEN un titular de lista y faltan 61 minutos para el inicio, o pasó fin + 4 h
- WHEN marca un invitado
- THEN recibe 403 y la UI lo muestra de solo lectura

## Dudas abiertas

- **Q19 (abierta, NO decidida):** ¿la lista de invitados (subida o marcas de asistencia) cuenta como "dato" para bloquear el borrado del evento (`actividad`)? Mientras no se decida, nada de invitados escribe `actividad`.
- **Q20 (supuesto):** un invitado ya marcado que desaparece en una re-subida se conserva como `removido` con su marca.
