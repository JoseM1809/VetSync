# Respuesta de la IA — Prompt 3 (TDD: tests de agendarCita)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Escribe 5 casos de prueba unitarios usando Jest para la función 'agendarCita'. Incluye casos de borde: veterinario ocupado, fecha en el pasado, y mascota no registrada. No escribas la implementación aún, solo los tests."
>
> Código generado por la IA (sin editar), guardado en `tests/unit/citas/agendarCita.test.ts`.

```ts
import { ServicioCitas } from '../../../src/modulos/citas/aplicacion/servicioCitas';
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
      relojFijo
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
});
```

## Resultado de ejecutarlos antes de implementar (fase ROJA)

```text
FAIL tests/unit/citas/agendarCita.test.ts
  ● Test suite failed to run

    tests/unit/citas/agendarCita.test.ts:1:31 - error TS2307: Cannot find module '../../../src/modulos/citas/aplicacion/servicioCitas' or its corresponding type declarations.

    1 import { ServicioCitas } from '../../../src/modulos/citas/aplicacion/servicioCitas';
                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    tests/unit/citas/agendarCita.test.ts:2:43 - error TS2307: Cannot find module '../../../src/modulos/citas/infraestructura/repositorioCitasEnMemoria' or its corresponding type declarations.

    2 import { RepositorioCitasEnMemoria } from '../../../src/modulos/citas/infraestructura/repositorioCitasEnMemoria';
                                                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    tests/unit/citas/agendarCita.test.ts:3:37 - error TS2307: Cannot find module '../../../src/compartido/consultaExistencia' or its corresponding type declarations.

    3 import { IConsultaExistencia } from '../../../src/compartido/consultaExistencia';
                                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    tests/unit/citas/agendarCita.test.ts:4:24 - error TS2307: Cannot find module '../../../src/compartido/reloj' or its corresponding type declarations.

    4 import { IReloj } from '../../../src/compartido/reloj';
                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    tests/unit/citas/agendarCita.test.ts:5:68 - error TS2307: Cannot find module '../../../src/compartido/errores' or its corresponding type declarations.

    5 import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';
                                                                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Test Suites: 1 failed, 1 total
```
