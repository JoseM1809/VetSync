import express, { Express } from 'express';
import { crearManejadorErrores } from './compartido/http';
import { IRegistro } from './compartido/registro';
import { cabecerasSeguridad, requerirTokenAdmin } from './compartido/seguridad';
import { IContenedor } from './contenedor';
import { crearRutaAgenda, crearRutasCitas } from './modulos/citas/http/rutasCitas';
import { crearRutasMascotas } from './modulos/mascotas/http/rutasMascotas';
import { crearRutasNotificaciones } from './modulos/notificaciones/http/rutasNotificaciones';
import { crearRutasPropietarios } from './modulos/propietarios/http/rutasPropietarios';
import { crearRutasVeterinarios } from './modulos/veterinarios/http/rutasVeterinarios';

export const crearApp = (contenedor: IContenedor, registro: IRegistro, tokenAdmin: string | null): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok' });
  });
  app.use('/api/propietarios', crearRutasPropietarios(contenedor.propietarios));
  app.use('/api/veterinarios', crearRutasVeterinarios(contenedor.veterinarios));
  app.use('/api/veterinarios', crearRutaAgenda(contenedor.citas));
  app.use('/api/mascotas', crearRutasMascotas(contenedor.mascotas));
  app.use('/api/citas', crearRutasCitas(contenedor.citas));
  app.use('/api/notificaciones', requerirTokenAdmin(tokenAdmin), crearRutasNotificaciones(contenedor.recordatorios, contenedor.notificaciones));

  app.use((_req, res) => {
    res.status(404).json({ error: 'ErrorNoEncontrado', mensaje: 'Ruta no encontrada' });
  });
  app.use(crearManejadorErrores(registro));

  return app;
};
