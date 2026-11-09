# API REST de VetSync

- **Base URL:** `http://localhost:3000/api`
- **Formato:** JSON (`Content-Type: application/json`), máximo 100 KB por petición.
- **Contrato formal:** [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1). Un test verifica que coincide con las rutas del código.
- **Fechas:** ISO 8601 **con zona horaria** (`2026-11-20T15:00:00Z` o `…-07:00`), o sólo fecha (`2026-11-20`). La fecha debe existir en el calendario (`2027-02-30` se rechaza). Las respuestas siempre en UTC.
- **IDs y números:** enteros positivos. En el cuerpo JSON deben ser números (`30`, no `"30"`); en la ruta (`/citas/5`) van como texto.
- **Textos:** se recortan espacios. Los campos de una línea no admiten caracteres de control; `tratamiento` y `notas` admiten saltos de línea y tabuladores.
- **Autenticación:** las rutas de usuario no tienen (ver *Limitaciones* en el README). Las rutas de `/notificaciones` exigen la cabecera `X-Token-Admin` con el valor de `TOKEN_ADMIN`.
- **Cabeceras de seguridad:** toda respuesta incluye `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y `Referrer-Policy: no-referrer`.

## Errores

Todos los errores tienen la misma forma:

```json
{ "error": "ErrorConflicto", "mensaje": "El veterinario ya tiene una cita en ese horario" }
```

| HTTP | `error` | Cuándo |
|---|---|---|
| 400 | `ErrorValidacion` | Campo faltante o con tipo/formato inválido, JSON mal formado, fecha en el pasado, duración fuera de rango |
| 401 | `ErrorNoAutorizado` | Ruta de administración sin `X-Token-Admin` o con un token incorrecto |
| 403 | `ErrorProhibido` | Ruta de administración deshabilitada porque `TOKEN_ADMIN` no está configurado |
| 404 | `ErrorNoEncontrado` | Recurso o ruta inexistente |
| 409 | `ErrorConflicto` | Email duplicado o choque de horario del veterinario |
| 500 | `ErrorInterno` | Error inesperado (sin detalles internos; se registra en el log) |

---

## Salud

### `GET /salud`
`200 { "estado": "ok" }`

## Propietarios

### `POST /propietarios`

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `nombre` | string | sí | 1–120 caracteres (se recortan espacios) |
| `email` | string | sí | formato email, único (se guarda en minúsculas) |
| `telefono` | string \| null | no | máx. 30 |

```json
// 201
{ "id": 1, "nombre": "Ana López", "email": "ana@correo.com", "telefono": "6621234567" }
```
Errores: 400, 409 (email ya registrado).

### `GET /propietarios/:id`
`200` propietario · `404`.

## Veterinarios

### `POST /veterinarios`
Campos: `nombre` (req.), `email` (req., único), `especialidad` (opcional, máx. 80). `201` con el veterinario.

### `GET /veterinarios`
`200` lista de veterinarios.

### `GET /veterinarios/:id`
`200` veterinario · `404`.

### `GET /veterinarios/:id/agenda?desde=…&hasta=…`
Citas del veterinario cuyo **inicio** está en `[desde, hasta)`, ordenadas por inicio (incluye canceladas).
Reglas: `hasta > desde`, rango máximo 31 días. `200` lista de citas · `400` · `404`.

## Mascotas e historial médico

### `POST /mascotas`

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `propietarioId` | entero | sí | el propietario debe existir (404 si no) |
| `nombre` | string | sí | máx. 80 |
| `especie` | string | sí | máx. 40 |
| `raza` | string \| null | no | máx. 80 |
| `fechaNacimiento` | fecha \| null | no | no puede ser futura |

```json
// 201
{ "id": 1, "propietarioId": 1, "nombre": "Michi", "especie": "Gato", "raza": null, "fechaNacimiento": "2023-05-01T00:00:00.000Z" }
```

### `GET /mascotas/:id`
`200` mascota · `404`.

### `POST /mascotas/:id/historial`

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `diagnostico` | string | sí | máx. 255 |
| `veterinarioId` | entero \| null | no | debe existir si se envía |
| `fecha` | fecha \| null | no | por defecto "ahora"; no puede ser futura |
| `tratamiento`, `notas` | string \| null | no | máx. 5000 |

`201` con el registro · `400` · `404` (mascota o veterinario).

### `GET /mascotas/:id/historial`
`200` registros del más reciente al más antiguo · `404`.

## Citas

### `POST /citas` — agendar

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `mascotaId` | entero | sí | debe existir |
| `veterinarioId` | entero | sí | debe existir |
| `inicio` | fecha ISO con zona | sí | estrictamente futura y a no más de 365 días |
| `duracionMinutos` | entero | sí | 1–240 |
| `motivo` | string | sí | 1–255 caracteres |
| `modalidad` | `"PRESENCIAL"` \| `"TELEMEDICINA"` | no | por defecto `PRESENCIAL` |

```bash
curl -X POST http://localhost:3000/api/citas -H "Content-Type: application/json" \
  -d '{"mascotaId":1,"veterinarioId":1,"inicio":"2026-11-20T15:00:00Z","duracionMinutos":30,"motivo":"Vacuna","modalidad":"TELEMEDICINA"}'
```

```json
// 201
{
  "id": 1, "mascotaId": 1, "veterinarioId": 1,
  "inicio": "2026-11-20T15:00:00.000Z", "fin": "2026-11-20T15:30:00.000Z",
  "motivo": "Vacuna", "modalidad": "TELEMEDICINA", "estado": "PROGRAMADA", "recordatorioEnviadoEn": null
}
```

**Regla de choque:** hay conflicto si existe otra cita `PROGRAMADA` del mismo veterinario con `inicio < nuevoFin` y `fin > nuevoInicio`.
Las citas **contiguas** (una termina 10:30 y la otra empieza 10:30) están permitidas; las **canceladas** liberan el horario.
La verificación es atómica: dos peticiones simultáneas al mismo horario producen un `201` y un `409`.

### `GET /citas/:id`
`200` cita · `404`.

### `PATCH /citas/:id/cancelar`
Sólo citas `PROGRAMADA`. `200` con la cita cancelada · `400` si ya no está programada · `404`.

## Notificaciones

Ambas rutas exigen la cabecera `X-Token-Admin`: responden **401** si falta o es incorrecta, y **403** si el servidor no tiene `TOKEN_ADMIN` configurado.

### `POST /notificaciones/recordatorios/ejecutar`
Ejecuta el job de recordatorios (el servidor también lo corre cada `MINUTOS_INTERVALO_RECORDATORIOS`).
Envía un correo **simulado** a cada cita `PROGRAMADA` que empieza en las próximas `HORAS_ANTICIPACION_RECORDATORIO` horas y aún no tiene recordatorio. Procesa hasta 200 citas por ejecución y no corre dos veces en paralelo.

```json
// 200
{ "enviados": 3, "fallidos": 0 }
```

### `GET /notificaciones?limite=50`
Últimas notificaciones enviadas (más recientes primero). `limite` entre 1 y 200 (por defecto 50).
