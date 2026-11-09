import request from 'supertest';
import { Express } from 'express';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor, IContenedor } from '../../src/contenedor';
import { crearRelojFijo, TOKEN_ADMIN } from '../apoyo/dobles';

/**
 * Pruebas contra un MySQL real (docker compose up -d o el servicio de la CI).
 * Se activan con PRUEBAS_MYSQL=1 para que `npm test` siga funcionando sin base de datos.
 */
const describirSiMySQL = process.env.PRUEBAS_MYSQL === '1' ? describe : describe.skip;

describirSiMySQL('API VetSync contra MySQL real', () => {
  let app: Express;
  let contenedor: IContenedor;
  const sufijo = Date.now();

  beforeAll(() => {
    const config = cargarConfiguracion({ ...process.env, PERSISTENCIA: 'mysql' });
    contenedor = construirContenedor(config, crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso);
    app = crearApp(contenedor, registroSilencioso, TOKEN_ADMIN);
  });

  afterAll(async () => {
    await contenedor.cerrar();
  });

  it('persiste el flujo completo y respeta las restricciones de la base de datos', async () => {
    const propietario = await request(app)
      .post('/api/propietarios')
      .send({ nombre: 'Ana', email: `ana${sufijo}@correo.com` })
      .expect(201);
    await request(app).post('/api/propietarios').send({ nombre: 'Ana 2', email: `ANA${sufijo}@correo.com` }).expect(409);

    const veterinario = await request(app)
      .post('/api/veterinarios')
      .send({ nombre: 'Dr. Soto', email: `soto${sufijo}@vetsync.mx` })
      .expect(201);
    const mascota = await request(app)
      .post('/api/mascotas')
      .send({ propietarioId: propietario.body.id, nombre: 'Rex', especie: 'Perro', fechaNacimiento: '2020-01-15' })
      .expect(201);
    const leida = await request(app).get(`/api/mascotas/${mascota.body.id}`).expect(200);
    expect(leida.body.fechaNacimiento).toBe('2020-01-15T00:00:00.000Z');

    await request(app)
      .post(`/api/mascotas/${mascota.body.id}/historial`)
      .send({ veterinarioId: veterinario.body.id, diagnostico: 'Chequeo', fecha: '2026-10-01T10:00:00Z' })
      .expect(201);
    const historial = await request(app).get(`/api/mascotas/${mascota.body.id}/historial`).expect(200);
    expect(historial.body[0].fecha).toBe('2026-10-01T10:00:00.000Z');

    // Detectado en la demo: DATETIME sin fracción redondeaba los milisegundos y la API
    // devolvía al leer un valor distinto del que respondió al crear.
    const conMilisegundos = await request(app)
      .post(`/api/mascotas/${mascota.body.id}/historial`)
      .send({ diagnostico: 'Control', fecha: '2026-10-02T10:00:00.567Z' })
      .expect(201);
    const releido = await request(app).get(`/api/mascotas/${mascota.body.id}/historial`).expect(200);
    expect(releido.body[0].fecha).toBe(conMilisegundos.body.fecha);

    const datosCita = {
      mascotaId: mascota.body.id,
      veterinarioId: veterinario.body.id,
      inicio: '2026-11-11T10:00:00Z',
      duracionMinutos: 30,
      motivo: 'Vacuna'
    };
    const cita = await request(app).post('/api/citas').send(datosCita).expect(201);
    expect(cita.body.inicio).toBe('2026-11-11T10:00:00.000Z');
    await request(app).post('/api/citas').send({ ...datosCita, inicio: '2026-11-11T10:10:00Z' }).expect(409);

    const agenda = await request(app)
      .get(`/api/veterinarios/${veterinario.body.id}/agenda`)
      .query({ desde: '2026-11-11T00:00:00Z', hasta: '2026-11-12T00:00:00Z' })
      .expect(200);
    expect(agenda.body).toHaveLength(1);

    const resumen = await request(app).post('/api/notificaciones/recordatorios/ejecutar').set('X-Token-Admin', TOKEN_ADMIN).expect(200);
    expect(resumen.body.enviados).toBeGreaterThanOrEqual(1);
    const releida = await request(app).get(`/api/citas/${cita.body.id}`).expect(200);
    expect(releida.body.recordatorioEnviadoEn).toBe('2026-11-10T15:00:00.000Z');

    await request(app).patch(`/api/citas/${cita.body.id}/cancelar`).expect(200);
    await request(app).post('/api/citas').send({ ...datosCita, inicio: '2026-11-11T10:10:00Z' }).expect(201);
  });

  it('no permite dos citas solapadas aunque lleguen al mismo tiempo', async () => {
    const propietario = await request(app).post('/api/propietarios').send({ nombre: 'Luis', email: `luis${sufijo}@correo.com` });
    const veterinario = await request(app).post('/api/veterinarios').send({ nombre: 'Dra. Paz', email: `paz${sufijo}@vetsync.mx` });
    const mascota = await request(app).post('/api/mascotas').send({ propietarioId: propietario.body.id, nombre: 'Kira', especie: 'Gato' });
    const datosCita = {
      mascotaId: mascota.body.id,
      veterinarioId: veterinario.body.id,
      inicio: '2026-11-15T10:00:00Z',
      duracionMinutos: 30,
      motivo: 'Consulta'
    };

    // Se llama al servicio directamente para que las 20 solicitudes compitan de verdad por el pool.
    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        contenedor.citas.agendarCita({ ...datosCita, inicio: new Date(datosCita.inicio), modalidad: 'PRESENCIAL' })
      )
    );

    const exitosas = resultados.filter((resultado) => resultado.status === 'fulfilled');
    expect(exitosas).toHaveLength(1);
    const agenda = await contenedor.citas.agendaVeterinario(
      veterinario.body.id,
      new Date('2026-11-15T00:00:00Z'),
      new Date('2026-11-16T00:00:00Z')
    );
    expect(agenda).toHaveLength(1);
  });
});
