import request from 'supertest';
import { Express } from 'express';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor } from '../../src/contenedor';
import { crearRelojFijo, TOKEN_ADMIN } from '../apoyo/dobles';

/**
 * Partición de equivalencia y valores límite de POST /api/citas.
 * Reloj fijo: 2026-11-10T15:00:00Z. Cada caso parte de una solicitud válida y cambia UN campo.
 */
type ICampos = Record<string, unknown>;

const BASE: ICampos = { inicio: '2026-11-11T10:00:00Z', duracionMinutos: 30, motivo: 'Consulta' };

const casos: [string, number, ICampos][] = [
  // ---- inicio ----
  ['inicio válido con Z', 201, {}],
  ['inicio con offset -07:00', 201, { inicio: '2026-11-11T10:00:00-07:00' }],
  ['inicio sólo con fecha (medianoche UTC)', 201, { inicio: '2026-11-12' }],
  ['inicio 1 minuto después de "ahora" (límite inferior válido)', 201, { inicio: '2026-11-10T15:01:00Z' }],
  ['inicio igual a "ahora" (límite inferior inválido)', 400, { inicio: '2026-11-10T15:00:00Z' }],
  ['inicio sin zona horaria', 400, { inicio: '2026-11-11T10:00:00' }],
  ['inicio en formato no ISO', 400, { inicio: '11/11/2026 10:00' }],
  ['inicio con mes 13', 400, { inicio: '2026-13-01T10:00:00Z' }],
  ['inicio 30 de febrero (fecha inexistente)', 400, { inicio: '2027-02-30T10:00:00Z' }],
  ['inicio 29 de febrero en año no bisiesto', 400, { inicio: '2027-02-29T10:00:00Z' }],
  ['inicio en el año 9999 (fuera de horizonte)', 400, { inicio: '9999-12-31T10:00:00Z' }],
  ['inicio como número (epoch)', 400, { inicio: 1794405600000 }],
  // ---- duracionMinutos ----
  ['duración 1 (mínimo)', 201, { duracionMinutos: 1 }],
  ['duración 240 (máximo)', 201, { duracionMinutos: 240 }],
  ['duración 0', 400, { duracionMinutos: 0 }],
  ['duración 241', 400, { duracionMinutos: 241 }],
  ['duración decimal', 400, { duracionMinutos: 12.5 }],
  ['duración como texto "30"', 400, { duracionMinutos: '30' }],
  ['duración null', 400, { duracionMinutos: null }],
  // ---- ids ----
  ['mascotaId 0', 400, { mascotaId: 0 }],
  ['mascotaId negativo', 400, { mascotaId: -1 }],
  ['mascotaId mayor que el entero seguro', 400, { mascotaId: 2 ** 53 }],
  ['mascotaId como texto "1"', 400, { mascotaId: '1' }],
  ['mascotaId inexistente', 404, { mascotaId: 999 }],
  ['veterinarioId inexistente', 404, { veterinarioId: 999 }],
  // ---- modalidad ----
  ['modalidad TELEMEDICINA', 201, { modalidad: 'TELEMEDICINA' }],
  ['modalidad en minúsculas', 400, { modalidad: 'telemedicina' }],
  ['modalidad null', 400, { modalidad: null }],
  // ---- motivo ----
  ['motivo de 255 caracteres (máximo)', 201, { motivo: 'x'.repeat(255) }],
  ['motivo de 256 caracteres', 400, { motivo: 'x'.repeat(256) }],
  ['motivo vacío', 400, { motivo: '' }],
  ['motivo numérico', 400, { motivo: 123 }]
];

describe('POST /api/citas — partición de equivalencia y valores límite', () => {
  let app: Express;
  let ids: ICampos;

  beforeEach(async () => {
    const contenedor = construirContenedor(cargarConfiguracion({}), crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso);
    app = crearApp(contenedor, registroSilencioso, TOKEN_ADMIN);
    const propietario = await request(app).post('/api/propietarios').send({ nombre: 'Ana', email: 'ana@correo.com' });
    const veterinario = await request(app).post('/api/veterinarios').send({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx' });
    const mascota = await request(app).post('/api/mascotas').send({ propietarioId: propietario.body.id, nombre: 'Michi', especie: 'Gato' });
    ids = { mascotaId: mascota.body.id, veterinarioId: veterinario.body.id };
  });

  it.each(casos)('%s → HTTP %i', async (_nombre, esperado, cambios) => {
    const respuesta = await request(app).post('/api/citas').send({ ...BASE, ...ids, ...cambios });

    expect(respuesta.status).toBe(esperado);
  });
});
