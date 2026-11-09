import { IConsultaExistencia } from '../../../compartido/consultaExistencia';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../../compartido/errores';
import { IReloj } from '../../../compartido/reloj';
import { textoRequerido } from '../../../compartido/validacion';
import { ICita, ISolicitudAgendarCita } from '../dominio/cita';
import { calcularIntervaloCita, ILimitesAgenda, validarRangoAgenda } from '../dominio/politicaAgendamiento';
import { IRepositorioCitas } from '../dominio/repositorioCitas';

export interface IServicioCitas {
  agendarCita(solicitud: ISolicitudAgendarCita): Promise<ICita>;
  obtenerCita(id: number): Promise<ICita>;
  agendaVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]>;
  cancelarCita(id: number): Promise<void>;
}

/** Orquestador del caso de uso; las reglas puras del calendario viven en dominio/politicaAgendamiento. */
export class ServicioCitas implements IServicioCitas {
  constructor(
    private readonly repositorioCitas: IRepositorioCitas,
    private readonly mascotas: IConsultaExistencia,
    private readonly veterinarios: IConsultaExistencia,
    private readonly reloj: IReloj,
    private readonly limites: ILimitesAgenda
  ) {}

  public async agendarCita(solicitud: ISolicitudAgendarCita): Promise<ICita> {
    const { inicio, fin } = calcularIntervaloCita(solicitud.inicio, solicitud.duracionMinutos, this.reloj.ahora(), this.limites);
    const motivo = textoRequerido(solicitud.motivo, 'motivo', 255);
    await this.asegurarMascota(solicitud.mascotaId);
    await this.asegurarVeterinario(solicitud.veterinarioId);

    // Verificar choque + insertar es UNA operación atómica del repositorio (hallazgo del code review).
    const cita = await this.repositorioCitas.crearSiLibre({
      mascotaId: solicitud.mascotaId,
      veterinarioId: solicitud.veterinarioId,
      inicio,
      fin,
      motivo,
      modalidad: solicitud.modalidad
    });
    if (!cita) {
      throw new ErrorConflicto('El veterinario ya tiene una cita en ese horario');
    }
    return cita;
  }

  public async obtenerCita(id: number): Promise<ICita> {
    const cita = await this.repositorioCitas.buscarPorId(id);
    if (!cita) {
      throw new ErrorNoEncontrado(`La cita ${id} no existe`);
    }
    return cita;
  }

  public async agendaVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]> {
    validarRangoAgenda(desde, hasta, this.limites);
    await this.asegurarVeterinario(veterinarioId);
    return this.repositorioCitas.listarPorVeterinario(veterinarioId, desde, hasta);
  }

  public async cancelarCita(id: number): Promise<void> {
    const cita = await this.obtenerCita(id);
    if (cita.estado !== 'PROGRAMADA') {
      throw new ErrorValidacion(`Sólo se pueden cancelar citas programadas (estado actual: ${cita.estado})`);
    }
    await this.repositorioCitas.actualizarEstado(id, 'CANCELADA');
  }

  private async asegurarMascota(mascotaId: number): Promise<void> {
    if (!(await this.mascotas.existe(mascotaId))) {
      throw new ErrorNoEncontrado(`La mascota ${mascotaId} no está registrada`);
    }
  }

  private async asegurarVeterinario(veterinarioId: number): Promise<void> {
    if (!(await this.veterinarios.existe(veterinarioId))) {
      throw new ErrorNoEncontrado(`El veterinario ${veterinarioId} no está registrado`);
    }
  }
}
