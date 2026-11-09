# Respuesta de la IA — Prompt propio 1 (ADR: estrategia contra la doble reserva)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal, con acceso al repositorio.
> **Prompt exacto:**
>
> "Actúa como Arquitecto de Software Principal especializado en sistemas transaccionales.
> **Contexto:** VetSync es un backend Node.js 22 + TypeScript + MySQL 8.4 (InnoDB, aislamiento por defecto) organizado como monolito modular hexagonal. La regla de negocio crítica es: un veterinario no puede tener dos citas en estado PROGRAMADA cuyos intervalos [inicio, fin) se solapen, aunque las peticiones lleguen al mismo tiempo. Las citas duran entre 1 y 240 minutos y pueden empezar en cualquier minuto.
> **Tarea:** redacta un Architecture Decision Record en formato MADR que compare al menos cuatro estrategias para garantizar esa invariante.
> **Para cada opción indica:** el mecanismo exacto en MySQL, el nivel de aislamiento que requiere, qué recibe el segundo cliente cuando dos peticiones compiten, el impacto en rendimiento y cómo se probaría.
> **Restricciones:** no propongas cambiar de motor de base de datos; cita únicamente comportamientos documentados de InnoDB.
> **Formato de salida:** Markdown con las secciones Contexto, Factores de decisión, Opciones, Comparación (tabla), Decisión y Consecuencias."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

# ADR-0001: Estrategia para impedir la doble reserva de un veterinario

- **Estado:** propuesto
- **Fecha:** 2026-11-08

## Contexto

`agendarCita` verifica si existe una cita solapada y luego inserta. Ejecutadas por separado, dos transacciones concurrentes pueden leer "libre" y ambas insertar (*time-of-check to time-of-use*). MySQL no tiene restricciones de exclusión sobre rangos (como `EXCLUDE USING gist` de PostgreSQL), y un `UNIQUE (veterinario_id, inicio)` no detecta solapamientos parciales, así que la invariante debe imponerse con control de concurrencia.

## Factores de decisión

1. Corrección bajo concurrencia (cero dobles reservas).
2. Respuesta limpia al perdedor: un **409 Conflicto**, no un 500.
3. No bloquear reservas de **otros** veterinarios.
4. Soportar duraciones arbitrarias (1–240 min, cualquier minuto de inicio).
5. Poder probarlo de forma automatizada.

## Opciones

### Opción A — Candado pesimista por veterinario (`SELECT … FOR UPDATE`)

Dentro de una transacción (REPEATABLE READ, el valor por defecto): `SELECT id FROM veterinarios WHERE id = ? FOR UPDATE`, luego la consulta de solapamiento y el `INSERT`; `COMMIT`. La segunda transacción **espera** en el `FOR UPDATE` hasta que la primera confirme; al continuar ve la cita ya insertada y responde 409. La espera máxima la fija `innodb_lock_wait_timeout` (50 s por defecto). Sólo serializa a un mismo veterinario.

### Opción B — Aislamiento `SERIALIZABLE`

`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`. InnoDB convierte los `SELECT` simples en lecturas con candado compartido (*next-key locks*) sobre el rango leído. Dos transacciones que leen el mismo rango vacío obtienen ambas el candado compartido; cuando las dos intentan insertar en ese hueco, cada una espera a la otra → **deadlock** (error 1213, `ER_LOCK_DEADLOCK`). InnoDB revierte una. El perdedor recibe un error que hay que capturar y **reintentar** para poder devolver 409.

### Opción C — Tabla de franjas con `UNIQUE`

Discretizar el tiempo en franjas (p. ej. de 5 min) y crear `franjas_ocupadas (veterinario_id, inicio_franja, cita_id)` con `UNIQUE (veterinario_id, inicio_franja)`. Al reservar se insertan todas las franjas de la cita en la misma transacción; si alguna ya existe, MySQL devuelve `ER_DUP_ENTRY` (1062) → 409. La base de datos impone la invariante sin depender del código. Desventajas: obliga a que inicio y duración sean múltiplos de la franja, multiplica filas (una cita de 4 h = 48 filas) y cancelar exige borrar sus franjas.

### Opción D — Candados con nombre (`GET_LOCK`)

`SELECT GET_LOCK(CONCAT('vet:', ?), 5)` antes de verificar e insertar, `RELEASE_LOCK` al terminar. Es un candado de **sesión**, no de transacción: debe liberarse en la misma conexión del pool, y si el proceso cae con la conexión viva el candado sigue tomado. Sólo protege a quien también lo pida: otra vía de escritura que no llame a `GET_LOCK` lo ignora.

### Opción E — Concurrencia optimista con versión

Columna `version` en `veterinarios`. Leer la versión, verificar solapamientos, insertar y `UPDATE veterinarios SET version = version + 1 WHERE id = ? AND version = ?`; si afecta 0 filas, alguien reservó antes → `ROLLBACK` y reintento (o 409). Sin esperas, pero con reintentos bajo contención.

## Comparación

| Criterio | A. FOR UPDATE | B. SERIALIZABLE | C. Franjas UNIQUE | D. GET_LOCK | E. Optimista |
|---|---|---|---|---|---|
| Cero dobles reservas | Sí | Sí | Sí (impuesto por la BD) | Sólo si todos lo usan | Sí |
| Perdedor recibe | Espera → 409 | Deadlock 1213 → reintento | 1062 → 409 | Espera → 409 | 0 filas → reintento/409 |
| Bloquea a otros veterinarios | No | Puede (candados de rango) | No | No | No |
| Duración libre | Sí | Sí | **No** (múltiplos de franja) | Sí | Sí |
| Complejidad | Baja | Media (reintentos) | Alta (franjas, cancelación) | Media (sesión/pool) | Media (reintentos) |
| Prueba | N peticiones paralelas: 1 éxito | Ídem + reintentos | Ídem | Ídem | Ídem |

## Decisión

Se elige la **Opción A**. Cumple los cinco factores con el menor código, responde 409 sin reintentos y aísla la contención por veterinario.

## Consecuencias

- Las reservas de un mismo veterinario se serializan; con volúmenes de una clínica (decenas de citas por hora) la espera es de milisegundos.
- La consulta de solapamiento DEBE ejecutarse dentro de la misma transacción y después del `FOR UPDATE`.
- Si en el futuro se necesitara una garantía impuesta por la base de datos (p. ej. escrituras desde otros sistemas), migrar a la Opción C.
- Prueba de aceptación: 20 reservas simultáneas del mismo horario → exactamente 1 éxito.
