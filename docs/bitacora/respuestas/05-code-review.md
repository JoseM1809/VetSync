# Respuesta de la IA — Prompt 5 (Code Review de seguridad y rendimiento)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Actúa como un experto en Ciberseguridad y Rendimiento. Revisa el siguiente código en busca de: 1) Vulnerabilidades (SQLi, XSS), 2) Fugas de memoria, 3) Queries ineficientes (N+1). Sé crítico y sugiere correcciones."
> **Código revisado:** todo `src/` después de la refactorización SOLID (repositorios MySQL, servicios, rutas, `servidor.ts`).
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## Resumen

| Severidad | Hallazgo | Categoría |
|---|---|---|
| 🔴 Crítica | Condición de carrera en `agendarCita`: doble reserva del mismo horario | Integridad / concurrencia |
| 🔴 Alta | La API no tiene autenticación: cualquiera lee historiales médicos y correos (IDOR) | Seguridad |
| 🟠 Media | El job de recordatorios puede ejecutarse en paralelo consigo mismo → correos duplicados | Concurrencia |
| 🟠 Media | `GET /api/notificaciones` y `buscarPendientesDeRecordatorio` sin límite → respuestas y memoria sin cota | Memoria / rendimiento |
| 🟡 Baja | Mensajes 409 devuelven el email ("Ya existe un propietario con el email X") → enumeración de usuarios | Seguridad |
| 🟡 Baja | Interpolación `${COLUMNAS}` en las sentencias SQL | SQLi (a revisar) |
| 🟡 Baja | Índice `(veterinario_id, estado, inicio)` no se aprovecha completo en la consulta de agenda | Rendimiento |
| ✅ OK | Sin N+1 en el job (contactos en lote con un JOIN) | Rendimiento |

## 1. Vulnerabilidades

**SQL Injection.** Todas las consultas que reciben datos del usuario usan placeholders `?` con `pool.execute` (sentencias preparadas). `DirectorioContactosMySQL` usa `pool.query` con `IN (?)`; mysql2 expande y escapa el array del lado cliente, así que también es seguro. Sin embargo, `SELECT ${COLUMNAS} FROM citas ...` construye SQL con *template strings*: es un patrón peligroso porque un cambio futuro podría introducir datos del usuario en esa interpolación. **Sugerencia:** escribir las columnas literalmente en cada consulta.

**XSS.** La API sólo responde `application/json`, por lo que no hay XSS reflejado en el backend. El riesgo está en el **correo**: `nombreMascota`, `nombrePropietario` y `motivo` vienen del usuario y se interpolan en el cuerpo. Hoy el correo es texto plano; si se cambia a HTML, hay que escapar esos valores.

**Autenticación / autorización (no pedido, pero crítico).** No hay autenticación: `GET /api/mascotas/:id/historial` expone datos médicos a cualquiera que adivine un id secuencial (IDOR). Recomendación: JWT + roles (dueño sólo ve sus mascotas; veterinario ve su agenda) y rate limiting (`express-rate-limit`).

**Enumeración.** Los 409 confirman que un email existe. Usar un mensaje genérico.

## 2. Fugas de memoria / recursos

- `setInterval` del job se limpia en `SIGINT/SIGTERM` y el pool se cierra con `pool.end()`: correcto.
- **Solapamiento del job:** `setInterval(() => void ejecutarRecordatorios(), ...)` no espera a que termine la ejecución anterior. Si un lote tarda más que el intervalo (SMTP lento), dos ejecuciones leen las mismas citas pendientes *antes* de que alguna marque `recordatorio_enviado_en` → **correo duplicado** y promesas acumulándose. **Corrección:** bandera `enEjecucion` dentro del servicio (o `setTimeout` encadenado).
- **Listas sin límite:** `RepositorioNotificacionesMySQL.listar()` hace `SELECT` de toda la tabla; con meses de operación devuelve decenas de miles de filas y las serializa en memoria. Igual con `buscarPendientesDeRecordatorio`. **Corrección:** `LIMIT ?` con un tope (p. ej. 50 por página en la API, 200 por lote en el job).
- Los repositorios en memoria crecen sin límite, pero sólo se usan en desarrollo/tests: aceptable.

## 3. Queries ineficientes (N+1) y concurrencia

- **Sin N+1 en recordatorios:** `IDirectorioContactos.contactosDeMascotas(ids[])` resuelve todo el lote con un `JOIN ... WHERE m.id IN (?)`. Bien. (El adaptador en memoria sí itera por id, pero no toca BD.)
- Por cada recordatorio se ejecutan 2 escrituras (`UPDATE citas`, `INSERT notificaciones`). Aceptable para el volumen esperado.
- **🔴 Condición de carrera (TOCTOU) en `agendarCita`:**

  ```ts
  const solapadas = await this.repositorioCitas.buscarSolapadas(...); // 1. leer
  if (solapadas.length > 0) throw new ErrorConflicto(...);
  return this.repositorioCitas.crear(...);                             // 2. escribir
  ```

  Entre (1) y (2) otra petición puede leer "libre" e insertar. MySQL no puede expresar "intervalos que no se solapan" con un `UNIQUE`, así que el índice no lo evita. **Corrección:** hacer la verificación y la inserción **atómicas** en una transacción que serialice por veterinario:

  ```ts
  await conexion.beginTransaction();
  await conexion.execute('SELECT id FROM veterinarios WHERE id = ? FOR UPDATE', [veterinarioId]); // candado por veterinario
  const [solapadas] = await conexion.execute('SELECT id FROM citas WHERE veterinario_id = ? AND estado = "PROGRAMADA" AND inicio < ? AND fin > ? ', [...]);
  if (solapadas.length > 0) { await conexion.rollback(); return null; }
  await conexion.execute('INSERT INTO citas ...');
  await conexion.commit();
  ```

  Y exponerlo en el puerto como una sola operación: `IRepositorioCitas.crearSiLibre(cita): Promise<ICita | null>`. Alternativa: aislamiento `SERIALIZABLE` en esa transacción.

- **Índice de agenda:** `WHERE veterinario_id = ? AND inicio >= ? AND inicio < ?` no filtra por `estado`, así que del índice `(veterinario_id, estado, inicio)` sólo se usa el prefijo `veterinario_id`. Con agendas de cientos de citas no importa; si crece, agregar `INDEX (veterinario_id, inicio)`.
