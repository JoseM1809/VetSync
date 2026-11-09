import { Router } from 'express';
import { leerCuerpo, leerEnteroPositivo, leerTexto, leerTextoOpcional, manejarAsync } from '../../../compartido/http';
import { IServicioVeterinarios } from '../aplicacion/servicioVeterinarios';

export const crearRutasVeterinarios = (servicio: IServicioVeterinarios): Router => {
  const rutas = Router();

  rutas.post(
    '/',
    manejarAsync(async (req, res) => {
      const cuerpo = leerCuerpo(req.body);
      const veterinario = await servicio.registrar({
        nombre: leerTexto(cuerpo, 'nombre'),
        email: leerTexto(cuerpo, 'email'),
        especialidad: leerTextoOpcional(cuerpo, 'especialidad')
      });
      res.status(201).json(veterinario);
    })
  );

  rutas.get(
    '/',
    manejarAsync(async (_req, res) => {
      res.json(await servicio.listar());
    })
  );

  rutas.get(
    '/:id',
    manejarAsync(async (req, res) => {
      res.json(await servicio.obtener(leerEnteroPositivo(req.params.id, 'id')));
    })
  );

  return rutas;
};
