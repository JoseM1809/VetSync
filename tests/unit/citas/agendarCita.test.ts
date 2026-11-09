import { ServicioCitas } from '../../../src/modulos/citas/aplicacion/servicioCitas';
import { LIMITES_AGENDA_POR_DEFECTO } from '../../../src/modulos/citas/dominio/politicaAgendamiento';
import { RepositorioCitasEnMemoria } from '../../../src/modulos/citas/infraestructura/repositorioCitasEnMemoria';
import { IConsultaExistencia } from '../../../src/compartido/consultaExistencia';
import { IReloj } from '../../../src/compartido/reloj';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';

const AHORA = new Date('2026-11-10T15:00:00Z');
const MASCOTA_REGISTRADA = 1;
const VETERINARIO_REGISTRADO = 10;

const relojFijo: IReloj = { ahora: () => AHORA };
const crearConsulta = (idsExistentes: number[]): IConsultaExistencia => ({
  existe: async (id: number) => idsExistentes.includes(id)
});

describe('ServicioCitas.agendarCita', () => {
  let repositorioCitas: RepositorioCitasEnMemoria;
  let servicio: ServicioCitas;

  beforeEach(() => {
    repositorioCitas = new RepositorioCitasEnMemoria();
    servicio = new ServicioCitas(
      repositorioCitas,
      crearConsulta([MASCOTA_REGISTRADA]),
      crearConsulta([VETERINARIO_REGISTRADO]),
      relojFijo,
      LIMITES_AGENDA_POR_DEFECTO
    );
  });

  it('agenda la cita cuando el veterinario está libre', async () => {
    const cita = await servicio.agendarCita({
      mascotaId: MASCOTA_REGISTRADA,
      veterinarioId: VETERINARIO_REGISTRADO,
      inicio: new Date('2026-11-11T10:00:00Z'),
      duracionMinutos: 30,
      motivo: 'Vacunación anual',
      modalidad: 'PRESENCIAL'
    });

    expect(cita.id).toBeDefined();
    expect(cita.estado).toBe('PROGRAMADA');
    expect(cita.fin.toISOString()).toBe('2026-11-11T10:30:00.000Z');
  });

  it('rechaza la cita si el veterinario ya está ocupado en un horario que se solapa', async () => {
    await servicio.agendarCita({
      mascotaId: MASCOTA_REGISTRADA,
      veterinarioId: VETERINARIO_REGISTRADO,
      inicio: new Date('2026-11-11T10:00:00Z'),
      duracionMinutos: 60,
      motivo: 'Consulta general',
      modalidad: 'PRESENCIAL'
    });

    await expect(
      servicio.agendarCita({
        mascotaId: MASCOTA_REGISTRADA,
        veterinarioId: VETERINARIO_REGISTRADO,
        inicio: new Date('2026-11-11T10:30:00Z'),
        duracionMinutos: 30,
        motivo: 'Revisión',
        modalidad: 'TELEMEDICINA'
      })
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('permite una cita contigua (empieza justo cuando termina la anterior)', async () => {
    await servicio.agendarCita({
      mascotaId: MASCOTA_REGISTRADA,
      veterinarioId: VETERINARIO_REGISTRADO,
      inicio: new Date('2026-11-11T10:00:00Z'),
      duracionMinutos: 30,
      motivo: 'Consulta general',
      modalidad: 'PRESENCIAL'
    });

    const contigua = await servicio.agendarCita({
      mascotaId: MASCOTA_REGISTRADA,
      veterinarioId: VETERINARIO_REGISTRADO,
      inicio: new Date('2026-11-11T10:30:00Z'),
      duracionMinutos: 30,
      motivo: 'Desparasitación',
      modalidad: 'PRESENCIAL'
    });

    expect(contigua.estado).toBe('PROGRAMADA');
  });

  it('rechaza una cita con fecha en el pasado', async () => {
    await expect(
      servicio.agendarCita({
        mascotaId: MASCOTA_REGISTRADA,
        veterinarioId: VETERINARIO_REGISTRADO,
        inicio: new Date('2026-11-09T10:00:00Z'),
        duracionMinutos: 30,
        motivo: 'Consulta general',
        modalidad: 'PRESENCIAL'
      })
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('rechaza la cita si la mascota no está registrada', async () => {
    await expect(
      servicio.agendarCita({
        mascotaId: 999,
        veterinarioId: VETERINARIO_REGISTRADO,
        inicio: new Date('2026-11-11T10:00:00Z'),
        duracionMinutos: 30,
        motivo: 'Consulta general',
        modalidad: 'PRESENCIAL'
      })
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  // ---- Casos agregados en la revisión humana (no los propuso la IA) ----

  const datosBase = {
    mascotaId: MASCOTA_REGISTRADA,
    veterinarioId: VETERINARIO_REGISTRADO,
    motivo: 'Consulta general',
    modalidad: 'PRESENCIAL' as const
  };

  it('rechaza la cita si el veterinario no está registrado', async () => {
    await expect(
      servicio.agendarCita({ ...datosBase, veterinarioId: 77, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos: 30 })
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('detecta el choque cuando la cita nueva envuelve por completo a una existente', async () => {
    await servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:30:00Z'), duracionMinutos: 15 });

    await expect(
      servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos: 120 })
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('permite el mismo horario con un veterinario distinto', async () => {
    const otroVeterinario = 11;
    servicio = new ServicioCitas(
      repositorioCitas,
      crearConsulta([MASCOTA_REGISTRADA]),
      crearConsulta([VETERINARIO_REGISTRADO, otroVeterinario]),
      relojFijo,
      LIMITES_AGENDA_POR_DEFECTO
    );
    await servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos: 30 });

    const cita = await servicio.agendarCita({
      ...datosBase,
      veterinarioId: otroVeterinario,
      inicio: new Date('2026-11-11T10:00:00Z'),
      duracionMinutos: 30
    });

    expect(cita.veterinarioId).toBe(otroVeterinario);
  });

  it('una cita cancelada libera el horario', async () => {
    const original = await servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos: 30 });
    await servicio.cancelarCita(original.id);

    const nueva = await servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos: 30 });

    expect(nueva.estado).toBe('PROGRAMADA');
  });

  it.each([0, -15, 241, 12.5])('rechaza una duración inválida (%p minutos)', async (duracionMinutos) => {
    await expect(
      servicio.agendarCita({ ...datosBase, inicio: new Date('2026-11-11T10:00:00Z'), duracionMinutos })
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('rechaza un inicio igual al instante actual (debe ser estrictamente futuro)', async () => {
    await expect(
      servicio.agendarCita({ ...datosBase, inicio: new Date(AHORA.getTime()), duracionMinutos: 30 })
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('ServicioCitas.cancelarCita', () => {
  it('lanza ErrorNoEncontrado si la cita no existe', async () => {
    const servicio = new ServicioCitas(new RepositorioCitasEnMemoria(), crearConsulta([]), crearConsulta([]), relojFijo, LIMITES_AGENDA_POR_DEFECTO);

    await expect(servicio.cancelarCita(404)).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });
});

describe('ServicioCitas.agendarCita - motivo (detectado al documentar la API)', () => {
  const servicio = () =>
    new ServicioCitas(
      new RepositorioCitasEnMemoria(),
      crearConsulta([MASCOTA_REGISTRADA]),
      crearConsulta([VETERINARIO_REGISTRADO]),
      relojFijo,
      LIMITES_AGENDA_POR_DEFECTO
    );
  const solicitud = (motivo: string) => ({
    mascotaId: MASCOTA_REGISTRADA,
    veterinarioId: VETERINARIO_REGISTRADO,
    inicio: new Date('2026-11-11T10:00:00Z'),
    duracionMinutos: 30,
    motivo,
    modalidad: 'PRESENCIAL' as const
  });

  it.each(['', '   ', 'x'.repeat(256)])('rechaza un motivo vacío o de más de 255 caracteres', async (motivo) => {
    await expect(servicio().agendarCita(solicitud(motivo))).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('guarda el motivo sin espacios sobrantes', async () => {
    const cita = await servicio().agendarCita(solicitud('  Vacuna  '));
    expect(cita.motivo).toBe('Vacuna');
  });
});

