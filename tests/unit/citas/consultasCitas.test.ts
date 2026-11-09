import { ServicioCitas } from '../../../src/modulos/citas/aplicacion/servicioCitas';
import { LIMITES_AGENDA_POR_DEFECTO } from '../../../src/modulos/citas/dominio/politicaAgendamiento';
import { RepositorioCitasEnMemoria } from '../../../src/modulos/citas/infraestructura/repositorioCitasEnMemoria';
import { ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';
import { crearConsulta, crearRelojFijo } from '../../apoyo/dobles';

const VETERINARIO = 10;

describe('ServicioCitas - consultas', () => {
  let servicio: ServicioCitas;

  const agendar = (inicioIso: string) =>
    servicio.agendarCita({
      mascotaId: 1,
      veterinarioId: VETERINARIO,
      inicio: new Date(inicioIso),
      duracionMinutos: 30,
      motivo: 'Consulta',
      modalidad: 'PRESENCIAL'
    });

  beforeEach(() => {
    servicio = new ServicioCitas(
      new RepositorioCitasEnMemoria(),
      crearConsulta([1]),
      crearConsulta([VETERINARIO]),
      crearRelojFijo('2026-11-10T15:00:00Z'),
      LIMITES_AGENDA_POR_DEFECTO
    );
  });

  it('obtiene una cita por id o lanza 404', async () => {
    const cita = await agendar('2026-11-11T10:00:00Z');

    expect(await servicio.obtenerCita(cita.id)).toEqual(cita);
    await expect(servicio.obtenerCita(999)).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('devuelve la agenda del veterinario ordenada y limitada al rango', async () => {
    await agendar('2026-11-12T09:00:00Z');
    await agendar('2026-11-11T10:00:00Z');
    await agendar('2026-11-20T10:00:00Z');

    const agenda = await servicio.agendaVeterinario(VETERINARIO, new Date('2026-11-11T00:00:00Z'), new Date('2026-11-13T00:00:00Z'));

    expect(agenda.map((cita) => cita.inicio.toISOString())).toEqual(['2026-11-11T10:00:00.000Z', '2026-11-12T09:00:00.000Z']);
  });

  it('valida el rango y la existencia del veterinario en la agenda', async () => {
    const lunes = new Date('2026-11-16T00:00:00Z');

    await expect(servicio.agendaVeterinario(VETERINARIO, lunes, lunes)).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(
      servicio.agendaVeterinario(VETERINARIO, lunes, new Date('2027-01-16T00:00:00Z'))
    ).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(
      servicio.agendaVeterinario(55, lunes, new Date('2026-11-17T00:00:00Z'))
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('no permite cancelar una cita que ya no está programada', async () => {
    const cita = await agendar('2026-11-11T10:00:00Z');
    await servicio.cancelarCita(cita.id);

    await expect(servicio.cancelarCita(cita.id)).rejects.toBeInstanceOf(ErrorValidacion);
  });
});
