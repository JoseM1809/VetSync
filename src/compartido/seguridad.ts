import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorNoAutorizado, ErrorProhibido } from './errores';

/** Cabeceras para una API JSON con datos médicos: nada se cachea ni se interpreta como HTML. */
export const cabecerasSeguridad: RequestHandler = (_req: Request, res: Response, siguiente: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  siguiente();
};

// timingSafeEqual lanza si las longitudes difieren: se comparan huellas SHA-256, que siempre miden 32 bytes.
const huella = (texto: string): Buffer => createHash('sha256').update(texto, 'utf8').digest();

/**
 * Protege rutas de administración con la cabecera `X-Token-Admin`.
 * Cerrado por defecto: si no hay token configurado, la ruta responde 403 siempre.
 */
export const requerirTokenAdmin =
  (tokenAdmin: string | null): RequestHandler =>
  (req: Request, _res: Response, siguiente: NextFunction): void => {
    if (tokenAdmin === null) {
      siguiente(new ErrorProhibido('Ruta de administración deshabilitada: configure TOKEN_ADMIN'));
      return;
    }
    const recibido = req.get('X-Token-Admin');
    if (recibido === undefined || !timingSafeEqual(huella(recibido), huella(tokenAdmin))) {
      siguiente(new ErrorNoAutorizado('Token de administrador ausente o inválido'));
      return;
    }
    siguiente();
  };
