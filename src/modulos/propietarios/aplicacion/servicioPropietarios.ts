import { IConsultaExistencia } from '../../../compartido/consultaExistencia';
import { ErrorConflicto, ErrorNoEncontrado } from '../../../compartido/errores';
import { emailNormalizado, textoOpcional, textoRequerido } from '../../../compartido/validacion';
import { INuevoPropietario, IPropietario, IRepositorioPropietarios } from '../dominio/propietario';

export interface IServicioPropietarios extends IConsultaExistencia {
  registrar(datos: INuevoPropietario): Promise<IPropietario>;
  obtener(id: number): Promise<IPropietario>;
}

export class ServicioPropietarios implements IServicioPropietarios {
  constructor(private readonly repositorio: IRepositorioPropietarios) {}

  public async registrar(datos: INuevoPropietario): Promise<IPropietario> {
    const propietario: INuevoPropietario = {
      nombre: textoRequerido(datos.nombre, 'nombre', 120),
      email: emailNormalizado(datos.email),
      telefono: textoOpcional(datos.telefono, 'telefono', 30)
    };
    if (await this.repositorio.buscarPorEmail(propietario.email)) {
      throw new ErrorConflicto('Ya existe un propietario registrado con ese email');
    }
    return this.repositorio.crear(propietario);
  }

  public async obtener(id: number): Promise<IPropietario> {
    const propietario = await this.repositorio.buscarPorId(id);
    if (!propietario) {
      throw new ErrorNoEncontrado(`El propietario ${id} no existe`);
    }
    return propietario;
  }

  public async existe(id: number): Promise<boolean> {
    return (await this.repositorio.buscarPorId(id)) !== null;
  }
}
