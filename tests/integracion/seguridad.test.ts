import request from 'supertest';
import { Express } from 'express';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { ErrorValidacion } from '../../src/compartido/errores';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor } from '../../src/contenedor';
import { crearRelojFijo } from '../apoyo/dobles';

/** Mitigaciones del modelado STRIDE / OWASP API Top 10 (prompt propio 4). */
const TOKEN = 'token-de-prueba-de-32-caracteres!';

const crear = (tokenAdmin: string | null): Express =>
  crearApp(
    construirContenedor(cargarConfiguracion({}), crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso),
    registroSilencioso,
    tokenAdmin
  );

describe('Seguridad de la API', () => {
  let app: Express;

  beforeEach(() => {
    app = crear(TOKEN);
  });

  describe('#3 rutas de administración protegidas con token (API5)', () => {
    it.each([
      ['sin cabecera', undefined],
      ['token incorrecto de la misma longitud', 'x'.repeat(TOKEN.length)],
      ['token incorrecto de otra longitud (no debe dar 500)', 'corto']
    ])('responde 401 %s', async (_caso, token) => {
      const peticion = request(app).get('/api/notificaciones');
      const respuesta = await (token === undefined ? peticion : peticion.set('X-Token-Admin', token));

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error).toBe('ErrorNoAutorizado');
    });

    it('permite el acceso con el token correcto', async () => {
      await request(app).get('/api/notificaciones').set('X-Token-Admin', TOKEN).expect(200);
      await request(app).post('/api/notificaciones/recordatorios/ejecutar').set('X-Token-Admin', TOKEN).expect(200);
    });

    it('cerrado por defecto: sin TOKEN_ADMIN configurado responde 403 aunque se envíe un token', async () => {
      const respuesta = await request(crear(null)).get('/api/notificaciones').set('X-Token-Admin', TOKEN).expect(403);

      expect(respuesta.body.error).toBe('ErrorProhibido');
    });

    it('las rutas públicas no exigen token', async () => {
      await request(app).get('/api/veterinarios').expect(200);
    });
  });

  describe('#5 caracteres de control en textos de una línea', () => {
    it('rechaza un nombre con salto de línea (inyección de cabeceras de correo)', async () => {
      const respuesta = await request(app)
        .post('/api/propietarios')
        .send({ nombre: 'Ana\r\nBcc: todos@ejemplo.com', email: 'ana@correo.com' })
        .expect(400);

      expect(respuesta.body.error).toBe(ErrorValidacion.name);
    });

    it('permite saltos de línea en campos multilínea (notas del historial)', async () => {
      const propietario = await request(app).post('/api/propietarios').send({ nombre: 'Ana', email: 'ana@correo.com' });
      const mascota = await request(app).post('/api/mascotas').send({ propietarioId: propietario.body.id, nombre: 'Michi', especie: 'Gato' });

      await request(app)
        .post(`/api/mascotas/${mascota.body.id}/historial`)
        .send({ diagnostico: 'Control', notas: 'Línea 1\nLínea 2\tcon tabulador' })
        .expect(201);
      await request(app)
        .post(`/api/mascotas/${mascota.body.id}/historial`)
        .send({ diagnostico: 'Control', notas: 'nulo\u0000oculto' })
        .expect(400);
    });
  });

  describe('#6 cabeceras de seguridad', () => {
    it('toda respuesta incluye nosniff, no-store, CSP y Referrer-Policy', async () => {
      const respuesta = await request(app).get('/api/salud');

      expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
    });
  });
});

describe('Configuración de TOKEN_ADMIN', () => {
  it('es opcional y exige al menos 16 caracteres si se define', () => {
    expect(cargarConfiguracion({}).tokenAdmin).toBeNull();
    expect(cargarConfiguracion({ TOKEN_ADMIN: TOKEN }).tokenAdmin).toBe(TOKEN);
    expect(() => cargarConfiguracion({ TOKEN_ADMIN: 'corto' })).toThrow(ErrorValidacion);
  });
});
