# Configuración de meseros Specification

## Purpose

Pantalla "Configuración" (`/app/admin/configuracion`, solo admin) donde se define cuántos meseros hacen falta según la cantidad de personas de un evento: intervalos o modo libre. La configuración solo produce una **sugerencia** de cuántos meseros necesita un evento, que la sección Cargos muestra como aviso comparándola con la cantidad de cargos del evento que tienen titular (Rev. 6: ya no hay `tipo` de cargo; ver `cargos-tareas`); no copia, no activa ni crea nada: si faltan, el jefe crea cargos en el evento a mano.

## Requirements

### Requirement: Acceso

Solo el admin MUST poder ver la pantalla y escribir `config/meseroRangos`. Admin y jefe MUST poder leerla (el jefe la necesita para ver el aviso de la sugerencia). El mesero MUST NOT leerla.

#### Scenario: Jefe navega a Configuración
- GIVEN un jefe
- WHEN navega a `/app/admin/configuracion`
- THEN es redirigido a `/app/eventos` y no ve el ítem en el menú

#### Scenario: Jefe escribe la configuración
- GIVEN un jefe
- WHEN escribe `config/meseroRangos`
- THEN recibe 403

#### Scenario: Jefe lee la configuración
- GIVEN un jefe
- WHEN hace GET `config/meseroRangos`
- THEN recibe 200

#### Scenario: Mesero lee la configuración
- GIVEN un mesero
- WHEN hace GET `config/meseroRangos`
- THEN recibe 403

### Requirement: Intervalos

En modo `rangos`, la configuración MUST tener cero o más intervalos `{desde, hasta?, meseros}`. `desde` y `meseros` MUST ser enteros positivos; `hasta`, si existe, MUST ser entero y `>= desde`; `hasta` ausente significa "o más" y MUST permitirse solo en el intervalo de mayor `desde`. Los intervalos MUST NOT superponerse (bordes inclusivos). Cada intervalo MUST poder editarse y borrarse. La configuración MUST guardarse completa en una sola escritura, con `actualizadoPor/En`. Las superposiciones las valida el cliente (las reglas no comparan intervalos entre sí); las reglas MUST validar tipos y `desde <= hasta`.

#### Scenario: Guardar intervalos válidos
- GIVEN el admin carga `1–50 → 3`, `51–100 → 5` y `101–(o más) → 8`
- WHEN guarda
- THEN `config/meseroRangos` queda con `modo = rangos`, los tres intervalos y `actualizadoPor = admin`

#### Scenario: Superposición
- GIVEN los intervalos `1–50` y `40–80`
- WHEN el admin intenta guardar
- THEN no se guarda y ve "Los intervalos 1–50 y 40–80 se superponen"

#### Scenario: Desde mayor que hasta
- GIVEN un intervalo `80–50`
- WHEN el admin intenta guardar
- THEN no se guarda y ve el error en ese intervalo

#### Scenario: Abierto que no es el último
- GIVEN `1–(o más)` y `51–100`
- WHEN el admin intenta guardar
- THEN no se guarda: solo el último intervalo puede ser "o más"

#### Scenario: No entero por la REST
- GIVEN un admin
- WHEN escribe `desde = 2.5` directo por la REST
- THEN la escritura se rechaza

#### Scenario: Borrar un intervalo
- GIVEN tres intervalos guardados
- WHEN el admin borra el del medio y guarda
- THEN quedan dos y el hueco no es un error (cae en "sin sugerencia")

### Requirement: Modo libre

La configuración MUST tener un `modo`: `rangos` o `libre`. En modo `libre` la cantidad de meseros NO depende de las personas y MUST NOT haber sugerencia. Pasar a `libre` MUST conservar los intervalos guardados, para poder volver a `rangos` sin cargarlos de nuevo.

#### Scenario: Activar modo libre
- GIVEN intervalos guardados
- WHEN el admin elige "Libre" y guarda
- THEN `modo = libre`, los intervalos siguen guardados y la UI avisa "No se sugiere cantidad de meseros"

### Requirement: Sugerencia de meseros

Una función pura MUST calcular la sugerencia a partir de la configuración y `info.personas` del evento: devuelve los `meseros` del intervalo con `desde <= personas <= hasta` (o `desde <= personas` si es abierto). MUST devolver "sin sugerencia" cuando el modo es `libre`, no hay configuración, `personas` falta o no es entero positivo, o ningún intervalo la contiene.

#### Scenario: Coincide un intervalo
- GIVEN intervalos `1–50 → 3`, `51–100 → 5` y un evento con 51 personas
- WHEN se calcula la sugerencia
- THEN es 5

#### Scenario: Intervalo abierto
- GIVEN `101–(o más) → 8` y un evento con 400 personas
- WHEN se calcula la sugerencia
- THEN es 8

#### Scenario: Sin personas
- GIVEN un evento sin `personas` (por ejemplo, uno viejo)
- WHEN se calcula la sugerencia
- THEN no hay sugerencia

#### Scenario: Modo libre
- GIVEN `modo = libre` y un evento con 120 personas
- WHEN se calcula la sugerencia
- THEN no hay sugerencia

#### Scenario: Hueco entre intervalos
- GIVEN `1–50` y `101–200` y un evento con 70 personas
- WHEN se calcula la sugerencia
- THEN no hay sugerencia

### Requirement: Personas del evento

`eventos/{eid}/info/personas` MUST ser opcional y, si existe, un entero `>= 1`. Admin y jefe lo cargan al crear o editar el evento.

#### Scenario: Personas inválidas
- GIVEN un jefe editando un evento
- WHEN guarda `personas = 0`
- THEN la operación se rechaza
