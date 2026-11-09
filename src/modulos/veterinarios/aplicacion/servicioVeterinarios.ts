import { IConsultaExistencia } from '../../../compartido/consultaExistencia';
import { ErrorConflicto, ErrorNoEncontrado } from '../../../compartido/errores';
import { emailNormalizado, textoOpcional, textoRequerido } from '../../../compartido/validacion';
import { INuevoVeterinario, IRepositorioVeterinarios, IVeterinario } from '../dominio/veterinario';

export interface IServicioVeterinarios extends IConsultaExistencia {
  registrar(datos: INuevoVeterinario): Promise<IVeterinario>;
  obtener(id: number): Promise<IVeterinario>;
  listar(): Promise<IVeterinario[]>;
}

export class ServicioVeterinarios implements IServicioVeterinarios {
  constructor(private readonly repositorio: IRepositorioVeterinarios) {}

  public async registrar(datos: INuevoVeterinario): Promise<IVeterinario> {
    const veterinario: INuevoVeterinario = {
      nombre: textoRequerido(datos.nombre, 'nombre', 120),
      email: emailNormalizado(datos.email),
      especialidad: textoOpcional(datos.especialidad, 'especialidad', 80)
    };
    if (await this.repositorio.buscarPorEmail(veterinario.email)) {
      throw new ErrorConflicto('Ya existe un veterinario registrado con ese email');
    }
    return this.repositorio.crear(veterinario);
  }

  public async obtener(id: number): Promise<IVeterinario> {
    const veterinario = await this.repositorio.buscarPorId(id);
    if (!veterinario) {
      throw new ErrorNoEncontrado(`El veterinario ${id} no existe`);
    }
    return veterinario;
  }

  public async listar(): Promise<IVeterinario[]> {
    return this.repositorio.listar();
  }

  public async existe(id: number): Promise<boolean> {
    return (await this.repositorio.buscarPorId(id)) !== null;
  }
}
