import { ServicioPropietarios } from '../../../src/modulos/propietarios/aplicacion/servicioPropietarios';
import { RepositorioPropietariosEnMemoria } from '../../../src/modulos/propietarios/infraestructura/repositorioPropietariosEnMemoria';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../../src/compartido/errores';

describe('ServicioPropietarios', () => {
  let servicio: ServicioPropietarios;

  beforeEach(() => {
    servicio = new ServicioPropietarios(new RepositorioPropietariosEnMemoria());
  });

  it('registra un propietario y normaliza nombre y email', async () => {
    const propietario = await servicio.registrar({ nombre: '  Ana López ', email: 'ANA@Correo.com', telefono: '6621234567' });

    expect(propietario).toMatchObject({ nombre: 'Ana López', email: 'ana@correo.com', telefono: '6621234567' });
    expect(await servicio.obtener(propietario.id)).toEqual(propietario);
  });

  it('rechaza un email con formato inválido', async () => {
    await expect(servicio.registrar({ nombre: 'Ana', email: 'no-es-email', telefono: null })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('rechaza un nombre vacío', async () => {
    await expect(servicio.registrar({ nombre: '   ', email: 'a@b.com', telefono: null })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('rechaza un email duplicado sin importar mayúsculas', async () => {
    await servicio.registrar({ nombre: 'Ana', email: 'ana@correo.com', telefono: null });

    await expect(servicio.registrar({ nombre: 'Otra Ana', email: 'Ana@correo.com', telefono: null })).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('lanza ErrorNoEncontrado al obtener un propietario inexistente', async () => {
    await expect(servicio.obtener(42)).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('expone existe() para otros módulos', async () => {
    const propietario = await servicio.registrar({ nombre: 'Ana', email: 'ana@correo.com', telefono: null });

    expect(await servicio.existe(propietario.id)).toBe(true);
    expect(await servicio.existe(999)).toBe(false);
  });
});
