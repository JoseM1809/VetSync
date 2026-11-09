import { ErrorValidacion } from '../../../compartido/errores';

/** Límites configurables del calendario (OCP: cambiar un límite no requiere tocar código). */
export interface ILimitesAgenda {
  duracionMaximaMinutos: number;
  rangoMaximoAgendaDias: number;
  /** Qué tan lejos en el futuro se puede agendar (evita citas en años mal capturados, p. ej. 2206). */
  horizonteMaximoDias: number;
}

export const LIMITES_AGENDA_POR_DEFECTO: ILimitesAgenda = {
  duracionMaximaMinutos: 240,
  rangoMaximoAgendaDias: 31,
  horizonteMaximoDias: 365
};

export interface IIntervalo {
  inicio: Date;
  fin: Date;
}

const MILISEGUNDOS_POR_MINUTO = 60_000;
const MILISEGUNDOS_POR_DIA = 86_400_000;

/** Valida duración e inicio estrictamente futuro y calcula el intervalo [inicio, fin). Función pura. */
export const calcularIntervaloCita = (inicio: Date, duracionMinutos: number, ahora: Date, limites: ILimitesAgenda): IIntervalo => {
  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0 || duracionMinutos > limites.duracionMaximaMinutos) {
    throw new ErrorValidacion(`La duración debe ser un entero entre 1 y ${limites.duracionMaximaMinutos} minutos`);
  }
  if (inicio.getTime() <= ahora.getTime()) {
    throw new ErrorValidacion('No se puede agendar una cita en el pasado');
  }
  if (inicio.getTime() - ahora.getTime() > limites.horizonteMaximoDias * MILISEGUNDOS_POR_DIA) {
    throw new ErrorValidacion(`Sólo se puede agendar con hasta ${limites.horizonteMaximoDias} días de anticipación`);
  }
  return { inicio, fin: new Date(inicio.getTime() + duracionMinutos * MILISEGUNDOS_POR_MINUTO) };
};

export const validarRangoAgenda = (desde: Date, hasta: Date, limites: ILimitesAgenda): void => {
  if (hasta <= desde) {
    throw new ErrorValidacion('"hasta" debe ser posterior a "desde"');
  }
  if (hasta.getTime() - desde.getTime() > limites.rangoMaximoAgendaDias * MILISEGUNDOS_POR_DIA) {
    throw new ErrorValidacion(`El rango de la agenda no puede superar ${limites.rangoMaximoAgendaDias} días`);
  }
};
