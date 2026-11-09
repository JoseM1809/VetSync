export type ModalidadCita = 'PRESENCIAL' | 'TELEMEDICINA';
export type EstadoCita = 'PROGRAMADA' | 'CANCELADA' | 'COMPLETADA';

export interface ICita {
  id: number;
  mascotaId: number;
  veterinarioId: number;
  inicio: Date;
  fin: Date;
  motivo: string;
  modalidad: ModalidadCita;
  estado: EstadoCita;
  recordatorioEnviadoEn: Date | null;
}

export type INuevaCita = Omit<ICita, 'id' | 'estado' | 'recordatorioEnviadoEn'>;

export interface ISolicitudAgendarCita {
  mascotaId: number;
  veterinarioId: number;
  inicio: Date;
  duracionMinutos: number;
  motivo: string;
  modalidad: ModalidadCita;
}
