import { ICitasPorRecordar } from '../../notificaciones/dominio/notificacion';
import { EstadoCita, ICita, INuevaCita } from '../dominio/cita';
import { IRepositorioCitas } from '../dominio/repositorioCitas';

export class RepositorioCitasEnMemoria implements IRepositorioCitas, ICitasPorRecordar {
  private readonly citas = new Map<number, ICita>();
  private siguienteId = 1;

  /** Sólo para preparar datos en pruebas: inserta sin verificar choques. */
  public async crear(cita: INuevaCita): Promise<ICita> {
    return this.crearSinVerificar(cita);
  }

  private crearSinVerificar(cita: INuevaCita): ICita {
    const creada: ICita = { ...cita, id: this.siguienteId++, estado: 'PROGRAMADA', recordatorioEnviadoEn: null };
    this.citas.set(creada.id, creada);
    return { ...creada };
  }

  public async buscarPorId(id: number): Promise<ICita | null> {
    const cita = this.citas.get(id);
    return cita ? { ...cita } : null;
  }

  /** Atómico en memoria: entre la verificación y la inserción no hay ningún `await`. */
  public async crearSiLibre(cita: INuevaCita): Promise<ICita | null> {
    const hayChoque = [...this.citas.values()].some(
      (existente) =>
        existente.veterinarioId === cita.veterinarioId &&
        existente.estado === 'PROGRAMADA' &&
        existente.inicio < cita.fin &&
        existente.fin > cita.inicio
    );
    return hayChoque ? null : this.crearSinVerificar(cita);
  }

  public async listarPorVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]> {
    return this.filtrar((cita) => cita.veterinarioId === veterinarioId && cita.inicio >= desde && cita.inicio < hasta);
  }

  public async actualizarEstado(id: number, estado: EstadoCita): Promise<void> {
    const cita = this.citas.get(id);
    if (cita) {
      cita.estado = estado;
    }
  }

  public async buscarPendientesDeRecordatorio(desde: Date, hasta: Date, limite: number): Promise<ICita[]> {
    return this.filtrar(
      (cita) => cita.estado === 'PROGRAMADA' && cita.recordatorioEnviadoEn === null && cita.inicio > desde && cita.inicio <= hasta
    ).slice(0, limite);
  }

  public async marcarRecordatorioEnviado(citaId: number, fecha: Date): Promise<void> {
    const cita = this.citas.get(citaId);
    if (cita) {
      cita.recordatorioEnviadoEn = fecha;
    }
  }

  private filtrar(criterio: (cita: ICita) => boolean): ICita[] {
    return [...this.citas.values()]
      .filter(criterio)
      .sort((citaA, citaB) => citaA.inicio.getTime() - citaB.inicio.getTime())
      .map((cita) => ({ ...cita }));
  }
}
