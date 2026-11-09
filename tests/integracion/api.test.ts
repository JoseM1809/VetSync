import request from 'supertest';
import { Express } from 'express';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor, IContenedor } from '../../src/contenedor';
import { crearRelojFijo, TOKEN_ADMIN } from '../apoyo/dobles';

describe('API VetSync (integración, persistencia en memoria)', () => {
  let app: Express;
  let contenedor: IContenedor;

  beforeEach(() => {
    contenedor = construirContenedor(cargarConfiguracion({}), crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso);
    app = crearApp(contenedor, registroSilencioso, TOKEN_ADMIN);
  });

  afterEach(async () => {
    await contenedor.cerrar();
  });

  const prepararDatos = async () => {
    const propietario = await request(app)
      .post('/api/propietarios')
      .send({ nombre: 'Ana López', email: 'ana@correo.com', telefono: '6621234567' })
      .expect(201);
    const veterinario = await request(app)
      .post('/api/veterinarios')
      .send({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx', especialidad: 'Felinos' })
      .expect(201);
    const mascota = await request(app)
      .post('/api/mascotas')
      .send({ propietarioId: propietario.body.id, nombre: 'Michi', especie: 'Gato', fechaNacimiento: '2023-05-01' })
      .expect(201);
    return { propietarioId: propietario.body.id as number, veterinarioId: veterinario.body.id as number, mascotaId: mascota.body.id as number };
  };

  it('responde al health check', async () => {
    await request(app).get('/api/salud').expect(200, { estado: 'ok' });
  });

  it('flujo completo: registro, historial, cita, choque, agenda, recordatorio y cancelación', async () => {
    const { propietarioId, veterinarioId, mascotaId } = await prepararDatos();

    await request(app).get(`/api/propietarios/${propietarioId}`).expect(200);
    await request(app).get(`/api/veterinarios/${veterinarioId}`).expect(200);
    const veterinarios = await request(app).get('/api/veterinarios').expect(200);
    expect(veterinarios.body).toHaveLength(1);
    await request(app).get(`/api/mascotas/${mascotaId}`).expect(200);

    await request(app)
      .post(`/api/mascotas/${mascotaId}/historial`)
      .send({ veterinarioId, diagnostico: 'Revisión general', tratamiento: 'Ninguno' })
      .expect(201);
    const historial = await request(app).get(`/api/mascotas/${mascotaId}/historial`).expect(200);
    expect(historial.body).toHaveLength(1);

    const cita = await request(app)
      .post('/api/citas')
      .send({ mascotaId, veterinarioId, inicio: '2026-11-11T10:00:00Z', duracionMinutos: 30, motivo: 'Vacuna', modalidad: 'TELEMEDICINA' })
      .expect(201);
    expect(cita.body).toMatchObject({ estado: 'PROGRAMADA', fin: '2026-11-11T10:30:00.000Z' });

    const choque = await request(app)
      .post('/api/citas')
      .send({ mascotaId, veterinarioId, inicio: '2026-11-11T10:15:00Z', duracionMinutos: 30, motivo: 'Otra' })
      .expect(409);
    expect(choque.body.error).toBe('ErrorConflicto');

    const agenda = await request(app)
      .get(`/api/veterinarios/${veterinarioId}/agenda`)
      .query({ desde: '2026-11-11T00:00:00Z', hasta: '2026-11-12T00:00:00Z' })
      .expect(200);
    expect(agenda.body).toHaveLength(1);

    const recordatorios = await request(app).post('/api/notificaciones/recordatorios/ejecutar').set('X-Token-Admin', TOKEN_ADMIN).expect(200);
    expect(recordatorios.body).toEqual({ enviados: 1, fallidos: 0 });
    const notificaciones = await request(app).get('/api/notificaciones').set('X-Token-Admin', TOKEN_ADMIN).query({ limite: 1 }).expect(200);
    expect(notificaciones.body).toHaveLength(1);
    expect(notificaciones.body[0].destinatario).toBe('ana@correo.com');
    await request(app).get('/api/notificaciones').set('X-Token-Admin', TOKEN_ADMIN).expect(200);
    await request(app).get('/api/notificaciones').set('X-Token-Admin', TOKEN_ADMIN).query({ limite: 500 }).expect(400);

    const cancelada = await request(app).patch(`/api/citas/${cita.body.id}/cancelar`).expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    await request(app).get(`/api/citas/${cita.body.id}`).expect(200);
  });

  it('valida la entrada HTTP y devuelve 400 con mensaje claro', async () => {
    const { mascotaId, veterinarioId } = await prepararDatos();

    const sinZona = await request(app)
      .post('/api/citas')
      .send({ mascotaId, veterinarioId, inicio: '2026-11-11 10:00', duracionMinutos: 30, motivo: 'X' })
      .expect(400);
    expect(sinZona.body.error).toBe('ErrorValidacion');

    await request(app).post('/api/citas').send({ mascotaId, veterinarioId, inicio: '2026-11-11T10:00:00Z', duracionMinutos: '30', motivo: 'X', modalidad: 'VIDEO' }).expect(400);
    await request(app).post('/api/citas').send({ mascotaId: -1, veterinarioId, inicio: '2026-11-11T10:00:00Z', duracionMinutos: 30, motivo: 'X' }).expect(400);
    await request(app).post('/api/propietarios').send({ nombre: 123, email: 'a@b.com' }).expect(400);
    await request(app).post('/api/propietarios').send([1, 2]).expect(400);
    await request(app).post('/api/propietarios').set('Content-Type', 'application/json').send('{"nombre":').expect(400);
    await request(app).get('/api/mascotas/abc').expect(400);
  });

  it('devuelve 404 para recursos y rutas inexistentes', async () => {
    await request(app).get('/api/propietarios/999').expect(404);
    await request(app).get('/api/citas/999').expect(404);
    await request(app).get('/api/no-existe').expect(404);
  });

  it('devuelve 500 genérico sin filtrar detalles ante errores inesperados', async () => {
    jest.spyOn(contenedor.veterinarios, 'listar').mockRejectedValueOnce(new Error('detalle interno secreto'));

    const respuesta = await request(app).get('/api/veterinarios').expect(500);

    expect(respuesta.body).toEqual({ error: 'ErrorInterno', mensaje: 'Ocurrió un error inesperado' });
  });
});
