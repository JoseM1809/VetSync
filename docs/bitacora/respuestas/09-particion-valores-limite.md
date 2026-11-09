# Respuesta de la IA — Prompt propio 2 (Partición de equivalencia y valores límite)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal, con acceso al repositorio.
> **Prompt exacto:**
>
> "Actúa como Ingeniero de QA especializado en diseño de casos de prueba.
> **Contexto:** en VetSync, `POST /api/citas` recibe JSON; la capa HTTP lo convierte con `leerFecha`, `leerEnteroPositivo` y `leerModalidad` (`src/compartido/http.ts`, `src/modulos/citas/http/rutasCitas.ts`) y después `ServicioCitas.agendarCita` aplica las reglas de negocio (`src/modulos/citas`). Usa un reloj fijo en `2026-11-10T15:00:00Z`.
> **Tarea:** aplica partición de equivalencia y análisis de valores límite a los campos `inicio`, `duracionMinutos`, `mascotaId`, `veterinarioId`, `modalidad` y `motivo`.
> **Entregables:** 1) una matriz con clase de equivalencia, valor representativo y código HTTP esperado según el contrato de la API; 2) la lista de casos que el código actual probablemente maneja mal, con el valor exacto que lo demuestra; 3) un archivo de pruebas Jest + supertest parametrizado con `it.each` que cubra la matriz.
> **Restricciones:** no modifiques código de producción; cada caso debe cambiar un solo campo respecto de una solicitud válida."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## 1. Matriz de partición

| Campo | Clase válida (esperado 201) | Clases inválidas (esperado 400/404) |
|---|---|---|
| `inicio` | ISO con `Z`; ISO con offset; sólo fecha; 1 min después de "ahora" | igual a "ahora"; sin zona; formato no ISO; mes 13; **fecha inexistente (30-feb)**; **29-feb en año no bisiesto**; **año 9999**; número epoch |
| `duracionMinutos` | 1 (mínimo); 240 (máximo) | 0; 241; 12.5; **texto "30"**; null |
| `mascotaId` / `veterinarioId` | entero existente | 0; negativo; > 2^53; **texto "1"**; inexistente (404) |
| `modalidad` | omitida; `TELEMEDICINA` | minúsculas; null |
| `motivo` | 255 caracteres (máximo) | 256 caracteres; vacío; numérico |

## 2. Casos que el código actual probablemente maneja mal

1. **Fechas de calendario inexistentes.** `leerFecha` valida el formato con una expresión regular y luego confía en `Date.parse`, que en V8 *normaliza* fechas imposibles: `2027-02-30T10:00:00Z` se convierte en el 2 de marzo. La cita se agendaría en otro día sin avisar al cliente.
2. **29 de febrero en año no bisiesto** (`2027-02-29`): mismo mecanismo, se convierte en 1 de marzo.
3. **Sin horizonte máximo.** Nada impide agendar en `9999-12-31`. Un error de captura (2206 en lugar de 2026) crearía una cita imposible de atender.
4. **Números enviados como texto.** `leerEnteroPositivo` acepta cadenas de dígitos (necesario para los parámetros de ruta como `/citas/:id`), pero eso hace que el cuerpo JSON acepte `"duracionMinutos": "30"` o `"mascotaId": "1"`, contradiciendo el tipo `integer` del contrato.

## 3. Pruebas generadas (`tests/integracion/particionCitas.test.ts`)

```ts
import request from 'supertest';
import { Express } from 'express';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor } from '../../src/contenedor';
import { crearRelojFijo } from '../apoyo/dobles';

/**
 * Partición de equivalencia y valores límite de POST /api/citas.
 * Reloj fijo: 2026-11-10T15:00:00Z. Cada caso parte de una solicitud válida y cambia UN campo.
 */
type ICampos = Record<string, unknown>;

const BASE: ICampos = { inicio: '2026-11-11T10:00:00Z', duracionMinutos: 30, motivo: 'Consulta' };

const casos: [string, ICampos, number][] = [
  // ---- inicio ----
  ['inicio válido con Z', {}, 201],
  ['inicio con offset -07:00', { inicio: '2026-11-11T10:00:00-07:00' }, 201],
  ['inicio sólo con fecha (medianoche UTC)', { inicio: '2026-11-12' }, 201],
  ['inicio 1 minuto después de "ahora" (límite inferior válido)', { inicio: '2026-11-10T15:01:00Z' }, 201],
  ['inicio igual a "ahora" (límite inferior inválido)', { inicio: '2026-11-10T15:00:00Z' }, 400],
  ['inicio sin zona horaria', { inicio: '2026-11-11T10:00:00' }, 400],
  ['inicio en formato no ISO', { inicio: '11/11/2026 10:00' }, 400],
  ['inicio con mes 13', { inicio: '2026-13-01T10:00:00Z' }, 400],
  ['inicio 30 de febrero (fecha inexistente)', { inicio: '2027-02-30T10:00:00Z' }, 400],
  ['inicio 29 de febrero en año no bisiesto', { inicio: '2027-02-29T10:00:00Z' }, 400],
  ['inicio en el año 9999 (fuera de horizonte)', { inicio: '9999-12-31T10:00:00Z' }, 400],
  ['inicio como número (epoch)', { inicio: 1794405600000 }, 400],
  // ---- duracionMinutos ----
  ['duración 1 (mínimo)', { duracionMinutos: 1 }, 201],
  ['duración 240 (máximo)', { duracionMinutos: 240 }, 201],
  ['duración 0', { duracionMinutos: 0 }, 400],
  ['duración 241', { duracionMinutos: 241 }, 400],
  ['duración decimal', { duracionMinutos: 12.5 }, 400],
  ['duración como texto "30"', { duracionMinutos: '30' }, 400],
  ['duración null', { duracionMinutos: null }, 400],
  // ---- ids ----
  ['mascotaId 0', { mascotaId: 0 }, 400],
  ['mascotaId negativo', { mascotaId: -1 }, 400],
  ['mascotaId mayor que el entero seguro', { mascotaId: 2 ** 53 }, 400],
  ['mascotaId como texto "1"', { mascotaId: '1' }, 400],
  ['mascotaId inexistente', { mascotaId: 999 }, 404],
  ['veterinarioId inexistente', { veterinarioId: 999 }, 404],
  // ---- modalidad ----
  ['modalidad TELEMEDICINA', { modalidad: 'TELEMEDICINA' }, 201],
  ['modalidad en minúsculas', { modalidad: 'telemedicina' }, 400],
  ['modalidad null', { modalidad: null }, 400],
  // ---- motivo ----
  ['motivo de 255 caracteres (máximo)', { motivo: 'x'.repeat(255) }, 201],
  ['motivo de 256 caracteres', { motivo: 'x'.repeat(256) }, 400],
  ['motivo vacío', { motivo: '' }, 400],
  ['motivo numérico', { motivo: 123 }, 400]
];

describe('POST /api/citas — partición de equivalencia y valores límite', () => {
  let app: Express;
  let ids: ICampos;

  beforeEach(async () => {
    const contenedor = construirContenedor(cargarConfiguracion({}), crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso);
    app = crearApp(contenedor, registroSilencioso);
    const propietario = await request(app).post('/api/propietarios').send({ nombre: 'Ana', email: 'ana@correo.com' });
    const veterinario = await request(app).post('/api/veterinarios').send({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx' });
    const mascota = await request(app).post('/api/mascotas').send({ propietarioId: propietario.body.id, nombre: 'Michi', especie: 'Gato' });
    ids = { mascotaId: mascota.body.id, veterinarioId: veterinario.body.id };
  });

  it.each(casos)('%s → HTTP %i', async (_nombre, cambios, esperado) => {
    const respuesta = await request(app).post('/api/citas').send({ ...BASE, ...ids, ...cambios });

    expect(respuesta.status).toBe(esperado);
  });
});
```

## Resultado de ejecutarlas sobre el código actual

```text
Tests:       5 failed, 27 passed, 32 total
  × inicio 30 de febrero (fecha inexistente)
  × inicio 29 de febrero en año no bisiesto
  × inicio en el año 9999 (fuera de horizonte)
  × duración como texto "30"
  × mascotaId como texto "1"
```
