import { Router } from 'express';
import { ErrorValidacion } from '../../../compartido/errores';
import { leerEnteroPositivo, manejarAsync } from '../../../compartido/http';
import { IServicioRecordatorios } from '../aplicacion/servicioRecordatorios';
import { IRepositorioNotificaciones } from '../dominio/notificacion';

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

export const crearRutasNotificaciones = (
  recordatorios: IServicioRecordatorios,
  notificaciones: IRepositorioNotificaciones
): Router => {
  const rutas = Router();

  /** Dispara manualmente el job de recordatorios (además del intervalo automático del servidor). */
  rutas.post(
    '/recordatorios/ejecutar',
    manejarAsync(async (_req, res) => {
      res.json(await recordatorios.enviarRecordatorios());
    })
  );

  rutas.get(
    '/',
    manejarAsync(async (req, res) => {
      const limite = req.query.limite === undefined ? LIMITE_POR_DEFECTO : leerEnteroPositivo(req.query.limite, 'limite');
      if (limite > LIMITE_MAXIMO) {
        throw new ErrorValidacion(`"limite" no puede ser mayor que ${LIMITE_MAXIMO}`);
      }
      res.json(await notificaciones.listar(limite));
    })
  );

  return rutas;
};
