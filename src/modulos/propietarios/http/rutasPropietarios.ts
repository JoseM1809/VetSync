import { Router } from 'express';
import { leerCuerpo, leerEnteroPositivo, leerTexto, leerTextoOpcional, manejarAsync } from '../../../compartido/http';
import { IServicioPropietarios } from '../aplicacion/servicioPropietarios';

export const crearRutasPropietarios = (servicio: IServicioPropietarios): Router => {
  const rutas = Router();

  rutas.post(
    '/',
    manejarAsync(async (req, res) => {
      const cuerpo = leerCuerpo(req.body);
      const propietario = await servicio.registrar({
        nombre: leerTexto(cuerpo, 'nombre'),
        email: leerTexto(cuerpo, 'email'),
        telefono: leerTextoOpcional(cuerpo, 'telefono')
      });
      res.status(201).json(propietario);
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
