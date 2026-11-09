import { Router } from 'express';
import { ErrorValidacion } from '../../../compartido/errores';
import { leerCuerpo, leerEnteroDelCuerpo, leerEnteroPositivo, leerFecha, leerTexto, manejarAsync } from '../../../compartido/http';
import { IServicioCitas } from '../aplicacion/servicioCitas';
import { ModalidadCita } from '../dominio/cita';

const leerModalidad = (valor: unknown): ModalidadCita => {
  if (valor === undefined) {
    return 'PRESENCIAL';
  }
  if (valor !== 'PRESENCIAL' && valor !== 'TELEMEDICINA') {
    throw new ErrorValidacion('"modalidad" debe ser PRESENCIAL o TELEMEDICINA');
  }
  return valor;
};

export const crearRutasCitas = (servicio: IServicioCitas): Router => {
  const rutas = Router();

  rutas.post(
    '/',
    manejarAsync(async (req, res) => {
      const cuerpo = leerCuerpo(req.body);
      const cita = await servicio.agendarCita({
        mascotaId: leerEnteroDelCuerpo(cuerpo.mascotaId, 'mascotaId'),
        veterinarioId: leerEnteroDelCuerpo(cuerpo.veterinarioId, 'veterinarioId'),
        inicio: leerFecha(cuerpo.inicio, 'inicio'),
        duracionMinutos: leerEnteroDelCuerpo(cuerpo.duracionMinutos, 'duracionMinutos'),
        motivo: leerTexto(cuerpo, 'motivo'),
        modalidad: leerModalidad(cuerpo.modalidad)
      });
      res.status(201).json(cita);
    })
  );

  rutas.get(
    '/:id',
    manejarAsync(async (req, res) => {
      res.json(await servicio.obtenerCita(leerEnteroPositivo(req.params.id, 'id')));
    })
  );

  rutas.patch(
    '/:id/cancelar',
    manejarAsync(async (req, res) => {
      const id = leerEnteroPositivo(req.params.id, 'id');
      await servicio.cancelarCita(id);
      res.json(await servicio.obtenerCita(id));
    })
  );

  return rutas;
};

/** GET /api/veterinarios/:id/agenda?desde=...&hasta=... (vive en citas porque la agenda son citas). */
export const crearRutaAgenda = (servicio: IServicioCitas): Router => {
  const rutas = Router();

  rutas.get(
    '/:id/agenda',
    manejarAsync(async (req, res) => {
      const agenda = await servicio.agendaVeterinario(
        leerEnteroPositivo(req.params.id, 'id'),
        leerFecha(req.query.desde, 'desde'),
        leerFecha(req.query.hasta, 'hasta')
      );
      res.json(agenda);
    })
  );

  return rutas;
};
