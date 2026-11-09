import { ServicioVeterinarios } from '../../../src/modulos/veterinarios/aplicacion/servicioVeterinarios';
import { RepositorioVeterinariosEnMemoria } from '../../../src/modulos/veterinarios/infraestructura/repositorioVeterinariosEnMemoria';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';

describe('ServicioVeterinarios', () => {
  let servicio: ServicioVeterinarios;

  beforeEach(() => {
    servicio = new ServicioVeterinarios(new RepositorioVeterinariosEnMemoria());
  });

  it('registra y lista veterinarios', async () => {
    await servicio.registrar({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx', especialidad: 'Felinos' });
    await servicio.registrar({ nombre: 'Dr. Soto', email: 'soto@vetsync.mx', especialidad: null });

    const lista = await servicio.listar();

    expect(lista.map((vet) => vet.nombre)).toEqual(['Dra. Ruiz', 'Dr. Soto']);
  });

  it('rechaza email duplicado', async () => {
    await servicio.registrar({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx', especialidad: null });

    await expect(servicio.registrar({ nombre: 'Otra', email: 'RUIZ@vetsync.mx', especialidad: null })).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('rechaza datos inválidos', async () => {
    await expect(servicio.registrar({ nombre: '', email: 'x@y.com', especialidad: null })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(servicio.registrar({ nombre: 'Dr. X', email: 'x@', especialidad: null })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('obtiene por id, lanza 404 si no existe y expone existe()', async () => {
    const vet = await servicio.registrar({ nombre: 'Dra. Ruiz', email: 'ruiz@vetsync.mx', especialidad: null });

    expect(await servicio.obtener(vet.id)).toEqual(vet);
    await expect(servicio.obtener(99)).rejects.toBeInstanceOf(ErrorNoEncontrado);
    expect(await servicio.existe(vet.id)).toBe(true);
    expect(await servicio.existe(99)).toBe(false);
  });
});
