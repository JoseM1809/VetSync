import { EstadoCita, ICita, INuevaCita } from './cita';

export interface IRepositorioCitas {
  /**
   * Crea la cita SÓLO si el veterinario no tiene otra cita PROGRAMADA que se solape con [inicio, fin).
   * La verificación y la inserción DEBEN ser atómicas (evita doble reserva con peticiones concurrentes).
   * Devuelve `null` si hay choque.
   */
  crearSiLibre(cita: INuevaCita): Promise<ICita | null>;
  buscarPorId(id: number): Promise<ICita | null>;
  /** Agenda del veterinario: citas cuyo inicio está en [desde, hasta), ordenadas por inicio. */
  listarPorVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]>;
  actualizarEstado(id: number, estado: EstadoCita): Promise<void>;
}
