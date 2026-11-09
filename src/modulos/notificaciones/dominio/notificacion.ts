import { ICita } from '../../citas/dominio/cita';

export interface INotificacion {
  id: number;
  citaId: number;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  enviadoEn: Date;
}

export type INuevaNotificacion = Omit<INotificacion, 'id'>;

export interface IRepositorioNotificaciones {
  registrar(notificacion: INuevaNotificacion): Promise<INotificacion>;
  /** Las más recientes primero, como máximo `limite` (evita respuestas sin cota). */
  listar(limite: number): Promise<INotificacion[]>;
}

/** Vista que el módulo de notificaciones necesita del módulo de citas (ISP). */
export interface ICitasPorRecordar {
  /** Como máximo `limite` citas, las más próximas primero (procesamiento por lotes). */
  buscarPendientesDeRecordatorio(desde: Date, hasta: Date, limite: number): Promise<ICita[]>;
  marcarRecordatorioEnviado(citaId: number, fecha: Date): Promise<void>;
}

export interface IResumenRecordatorios {
  enviados: number;
  fallidos: number;
}
