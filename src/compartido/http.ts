import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorDominio, ErrorValidacion } from './errores';
import { IRegistro } from './registro';

export type ICuerpo = Record<string, unknown>;

/** Borde HTTP: cualquier promesa rechazada en un controlador llega al middleware de errores. */
export const manejarAsync =
  (controlador: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, siguiente: NextFunction): void => {
    controlador(req, res).catch(siguiente);
  };

export const crearManejadorErrores =
  (registro: IRegistro) =>
  (error: unknown, _req: Request, res: Response, siguiente: NextFunction): void => {
    if (res.headersSent) {
      siguiente(error);
      return;
    }
    if (error instanceof ErrorDominio) {
      res.status(error.codigoHttp).json({ error: error.name, mensaje: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'ErrorValidacion', mensaje: 'El cuerpo de la petición no es JSON válido' });
      return;
    }
    registro.error('Error no controlado', error);
    res.status(500).json({ error: 'ErrorInterno', mensaje: 'Ocurrió un error inesperado' });
  };

export const leerCuerpo = (valor: unknown): ICuerpo => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new ErrorValidacion('El cuerpo de la petición debe ser un objeto JSON');
  }
  return valor as ICuerpo;
};

export const leerTexto = (cuerpo: ICuerpo, campo: string): string => {
  const valor = cuerpo[campo];
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`El campo "${campo}" es obligatorio y debe ser texto`);
  }
  return valor;
};

export const leerTextoOpcional = (cuerpo: ICuerpo, campo: string): string | null => {
  const valor = cuerpo[campo];
  if (valor === undefined || valor === null) {
    return null;
  }
  return leerTexto(cuerpo, campo);
};

export const leerEnteroPositivo = (valor: unknown, campo: string): number => {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isSafeInteger(numero) || numero <= 0) {
    throw new ErrorValidacion(`El campo "${campo}" debe ser un entero positivo`);
  }
  return numero;
};

/** Para el cuerpo JSON: el tipo debe ser number (en la ruta o la query se acepta texto con dígitos). */
export const leerEnteroDelCuerpo = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'number') {
    throw new ErrorValidacion(`El campo "${campo}" debe ser un número entero positivo, no texto`);
  }
  return leerEnteroPositivo(valor, campo);
};

export const leerEnteroOpcional = (cuerpo: ICuerpo, campo: string): number | null => {
  const valor = cuerpo[campo];
  return valor === undefined || valor === null ? null : leerEnteroDelCuerpo(valor, campo);
};

export const leerFecha = (valor: unknown, campo: string): Date => {
  // Se exige ISO 8601 con zona horaria explícita (Z u offset) para evitar ambigüedad de husos.
  const patronIso = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (typeof valor !== 'string' || !patronIso.test(valor) || Number.isNaN(Date.parse(valor))) {
    throw new ErrorValidacion(`El campo "${campo}" debe ser una fecha ISO 8601 (p. ej. 2026-11-20T15:00:00Z)`);
  }
  if (!existeEnCalendario(valor)) {
    throw new ErrorValidacion(`El campo "${campo}" no es una fecha del calendario (${valor.slice(0, 10)})`);
  }
  return new Date(valor);
};

/** Date.parse "normaliza" fechas imposibles (2027-02-30 → 2 de marzo); aquí se rechazan. */
const existeEnCalendario = (iso: string): boolean => {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

export const leerFechaOpcional = (cuerpo: ICuerpo, campo: string): Date | null => {
  const valor = cuerpo[campo];
  return valor === undefined || valor === null ? null : leerFecha(valor, campo);
};
