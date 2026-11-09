import { ServicioMascotas } from '../../../src/modulos/mascotas/aplicacion/servicioMascotas';
import { RepositorioMascotasEnMemoria } from '../../../src/modulos/mascotas/infraestructura/repositorioMascotasEnMemoria';
import { RepositorioHistorialEnMemoria } from '../../../src/modulos/mascotas/infraestructura/repositorioHistorialEnMemoria';
import { ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';
import { crearConsulta, crearRelojFijo } from '../../apoyo/dobles';

const PROPIETARIO = 1;
const VETERINARIO = 10;

describe('ServicioMascotas', () => {
  let servicio: ServicioMascotas;

  beforeEach(() => {
    servicio = new ServicioMascotas(
      new RepositorioMascotasEnMemoria(),
      new RepositorioHistorialEnMemoria(),
      crearConsulta([PROPIETARIO]),
      crearConsulta([VETERINARIO]),
      crearRelojFijo('2026-11-10T15:00:00Z')
    );
  });

  const nuevaMascota = {
    propietarioId: PROPIETARIO,
    nombre: 'Firulais',
    especie: 'Perro',
    raza: 'Mestizo',
    fechaNacimiento: new Date('2022-03-01T00:00:00Z')
  };

  it('registra una mascota de un propietario existente', async () => {
    const mascota = await servicio.registrarMascota(nuevaMascota);

    expect(mascota).toMatchObject({ id: expect.any(Number), nombre: 'Firulais', propietarioId: PROPIETARIO });
    expect(await servicio.obtenerMascota(mascota.id)).toEqual(mascota);
    expect(await servicio.existe(mascota.id)).toBe(true);
  });

  it('rechaza mascota de un propietario inexistente', async () => {
    await expect(servicio.registrarMascota({ ...nuevaMascota, propietarioId: 5 })).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('rechaza nombre o especie vacíos y fecha de nacimiento futura', async () => {
    await expect(servicio.registrarMascota({ ...nuevaMascota, nombre: ' ' })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(servicio.registrarMascota({ ...nuevaMascota, especie: '' })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(
      servicio.registrarMascota({ ...nuevaMascota, fechaNacimiento: new Date('2027-01-01T00:00:00Z') })
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('lanza 404 al obtener una mascota inexistente', async () => {
    await expect(servicio.obtenerMascota(123)).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  describe('historial médico', () => {
    it('agrega registros y devuelve el historial del más reciente al más antiguo', async () => {
      const mascota = await servicio.registrarMascota(nuevaMascota);

      await servicio.agregarRegistroMedico(mascota.id, {
        veterinarioId: VETERINARIO,
        fecha: new Date('2026-01-10T10:00:00Z'),
        diagnostico: 'Otitis',
        tratamiento: 'Gotas óticas',
        notas: null
      });
      await servicio.agregarRegistroMedico(mascota.id, {
        veterinarioId: null,
        fecha: null,
        diagnostico: 'Control de peso',
        tratamiento: null,
        notas: 'Dieta'
      });

      const historial = await servicio.obtenerHistorial(mascota.id);

      expect(historial.map((registro) => registro.diagnostico)).toEqual(['Control de peso', 'Otitis']);
      expect(historial[0].fecha.toISOString()).toBe('2026-11-10T15:00:00.000Z');
    });

    it('valida mascota, veterinario, diagnóstico y fecha futura', async () => {
      const mascota = await servicio.registrarMascota(nuevaMascota);
      const registro = { veterinarioId: VETERINARIO, fecha: null, diagnostico: 'Otitis', tratamiento: null, notas: null };

      await expect(servicio.agregarRegistroMedico(999, registro)).rejects.toBeInstanceOf(ErrorNoEncontrado);
      await expect(servicio.agregarRegistroMedico(mascota.id, { ...registro, veterinarioId: 55 })).rejects.toBeInstanceOf(ErrorNoEncontrado);
      await expect(servicio.agregarRegistroMedico(mascota.id, { ...registro, diagnostico: '' })).rejects.toBeInstanceOf(ErrorValidacion);
      await expect(
        servicio.agregarRegistroMedico(mascota.id, { ...registro, fecha: new Date('2030-01-01T00:00:00Z') })
      ).rejects.toBeInstanceOf(ErrorValidacion);
      await expect(servicio.obtenerHistorial(999)).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
  });
});
