# ADR-0001: Estrategia para impedir la doble reserva de un veterinario

- **Estado:** aceptado
- **Fecha:** 2026-11-08
- **Origen:** borrador generado por IA (prompt propio 1, ver `docs/bitacora/respuestas/08-adr-doble-reserva.md`), revisado y verificado experimentalmente contra MySQL 8.4.

## Contexto

`agendarCita` verifica si existe una cita solapada y luego inserta. Si ambos pasos no son atómicos, dos peticiones simultáneas pueden leer "libre" e insertar las dos. MySQL no tiene restricciones de exclusión sobre rangos, y un `UNIQUE (veterinario_id, inicio)` no detecta solapamientos parciales: la invariante se impone con control de concurrencia.

## Factores de decisión

1. Cero dobles reservas bajo concurrencia.
2. El perdedor recibe **409 Conflicto**, no un 500.
3. No bloquear reservas de otros veterinarios.
4. Duraciones arbitrarias (1–240 min, cualquier minuto de inicio).
5. Verificable con pruebas automatizadas.

## Opciones consideradas

| Criterio | A. `FOR UPDATE` por veterinario | B. `SERIALIZABLE` | C. Franjas con `UNIQUE` | D. `GET_LOCK` | E. Optimista (versión) |
|---|---|---|---|---|---|
| Cero dobles reservas | Sí | Sí | Sí (impuesto por la BD) | Sólo si todos lo usan | Sí |
| Perdedor recibe | Espera → 409 | **Deadlock 1213** → reintento | 1062 → 409 | Espera → 409 | 0 filas → reintento/409 |
| Bloquea a otros veterinarios | No | Puede (candados de rango) | No | No | No |
| Duración libre | Sí | Sí | No (múltiplos de franja) | Sí | Sí |
| Complejidad | Baja | Media | Alta | Media | Media |

Notas: en **D**, `GET_LOCK` es un candado de sesión. El riesgo real es devolver la conexión al pool sin `RELEASE_LOCK`: el candado queda tomado por esa conexión reutilizada. Si el proceso cae, la conexión se cierra y MySQL lo libera.

## Verificación experimental (MySQL 8.4, dos transacciones simultáneas sobre el mismo horario)

| Escenario | T1 | T2 | Citas guardadas |
|---|---|---|---|
| Sin protección (REPEATABLE READ) | insertó | insertó | **2** |
| B. SERIALIZABLE | error 1213 `ER_LOCK_DEADLOCK` | insertó | 1 |
| A. `FOR UPDATE` como primera sentencia | insertó | 409 | 1 |
| **A con una lectura previa antes del `FOR UPDATE`** | insertó | insertó | **2** |
| A con lectura previa + solapamiento `FOR SHARE` | insertó | 409 | 1 |

El cuarto escenario muestra que la Opción A, tal como estaba, dependía del **orden** de las sentencias. En REPEATABLE READ, InnoDB fija la "foto" de los datos en la primera lectura simple de la transacción. Si esa lectura ocurre antes de obtener el candado, la consulta de solapamiento no ve la cita que la otra transacción acaba de confirmar.

## Decisión

**Opción A, reforzada:** candado `SELECT … FOR UPDATE` sobre la fila del veterinario **y** consulta de solapamiento como lectura con candado (`… LIMIT 1 FOR SHARE`), que siempre lee la última versión confirmada sin importar el orden de las sentencias previas.

## Consecuencias

- Las reservas de un mismo veterinario se serializan (milisegundos con el volumen de una clínica); las de otros veterinarios no se afectan.
- Una espera mayor que `innodb_lock_wait_timeout` (50 s por defecto) produciría error 1205; no es esperable con transacciones de 3 sentencias.
- Si otro sistema llegara a escribir citas directamente en la base, migrar a la Opción C, que la base de datos impone por sí misma.
- Prueba de aceptación automatizada: `tests/integracion/mysql.test.ts`, 20 reservas simultáneas → exactamente 1 éxito.
