import { Router } from 'express';
import {
  leerCuerpo,
  leerEnteroDelCuerpo,
  leerEnteroOpcional,
  leerEnteroPositivo,
  leerFechaOpcional,
  leerTexto,
  leerTextoOpcional,
  manejarAsync
} from '../../../compartido/http';
import { IServicioMascotas } from '../aplicacion/servicioMascotas';

export const crearRutasMascotas = (servicio: IServicioMascotas): Router => {
  const rutas = Router();

  rutas.post(
    '/',
    manejarAsync(async (req, res) => {
      const cuerpo = leerCuerpo(req.body);
      const mascota = await servicio.registrarMascota({
        propietarioId: leerEnteroDelCuerpo(cuerpo.propietarioId, 'propietarioId'),
        nombre: leerTexto(cuerpo, 'nombre'),
        especie: leerTexto(cuerpo, 'especie'),
        raza: leerTextoOpcional(cuerpo, 'raza'),
        fechaNacimiento: leerFechaOpcional(cuerpo, 'fechaNacimiento')
      });
      res.status(201).json(mascota);
    })
  );

  rutas.get(
    '/:id',
    manejarAsync(async (req, res) => {
      res.json(await servicio.obtenerMascota(leerEnteroPositivo(req.params.id, 'id')));
    })
  );

  rutas.post(
    '/:id/historial',
    manejarAsync(async (req, res) => {
      const cuerpo = leerCuerpo(req.body);
      const registro = await servicio.agregarRegistroMedico(leerEnteroPositivo(req.params.id, 'id'), {
        veterinarioId: leerEnteroOpcional(cuerpo, 'veterinarioId'),
        fecha: leerFechaOpcional(cuerpo, 'fecha'),
        diagnostico: leerTexto(cuerpo, 'diagnostico'),
        tratamiento: leerTextoOpcional(cuerpo, 'tratamiento'),
        notas: leerTextoOpcional(cuerpo, 'notas')
      });
      res.status(201).json(registro);
    })
  );

  rutas.get(
    '/:id/historial',
    manejarAsync(async (req, res) => {
      res.json(await servicio.obtenerHistorial(leerEnteroPositivo(req.params.id, 'id')));
    })
  );

  return rutas;
};
