import { cargarConfiguracion } from '../../../src/compartido/configuracion';
import { ErrorValidacion } from '../../../src/compartido/errores';
import { RegistroConsola } from '../../../src/compartido/registro';
import { RelojSistema } from '../../../src/compartido/reloj';

describe('cargarConfiguracion', () => {
  it('usa valores por defecto seguros (memoria, puerto 3000, 24 h)', () => {
    const config = cargarConfiguracion({});

    expect(config).toMatchObject({ puerto: 3000, persistencia: 'memoria', horasAnticipacionRecordatorio: 24, minutosIntervaloRecordatorios: 5 });
  });

  it('lee variables de MySQL', () => {
    const config = cargarConfiguracion({
      PERSISTENCIA: 'mysql',
      MYSQL_HOST: 'db',
      MYSQL_PUERTO: '3307',
      MYSQL_USUARIO: 'u',
      MYSQL_CONTRASENA: 'p',
      MYSQL_BASE_DATOS: 'b'
    });

    expect(config.mysql).toEqual({ host: 'db', puerto: 3307, usuario: 'u', contrasena: 'p', baseDatos: 'b' });
  });

  it('rechaza valores inválidos', () => {
    expect(() => cargarConfiguracion({ PERSISTENCIA: 'mongo' })).toThrow(ErrorValidacion);
    expect(() => cargarConfiguracion({ PUERTO: 'abc' })).toThrow(ErrorValidacion);
    expect(() => cargarConfiguracion({ PUERTO: '-1' })).toThrow(ErrorValidacion);
  });
});

describe('adaptadores de sistema', () => {
  it('RelojSistema devuelve la hora actual', () => {
    const antes = Date.now();
    expect(new RelojSistema().ahora().getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('RegistroConsola escribe en consola', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const registro = new RegistroConsola();

    registro.info('hola');
    registro.error('falló', new Error('causa'));
    registro.error('sin causa');

    expect(log).toHaveBeenCalledWith(expect.stringContaining('hola'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('causa'));
    log.mockRestore();
    error.mockRestore();
  });
});
