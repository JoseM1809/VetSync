import { IConsultaExistencia } from '../../../compartido/consultaExistencia';
import { ErrorNoEncontrado, ErrorValidacion } from '../../../compartido/errores';
import { IReloj } from '../../../compartido/reloj';
import { textoOpcional, textoRequerido } from '../../../compartido/validacion';
import {
  IMascota,
  INuevaMascota,
  IRegistroMedico,
  IRepositorioHistorial,
  IRepositorioMascotas,
  ISolicitudRegistroMedico
} from '../dominio/mascota';

export interface IServicioMascotas extends IConsultaExistencia {
  registrarMascota(datos: INuevaMascota): Promise<IMascota>;
  obtenerMascota(id: number): Promise<IMascota>;
  agregarRegistroMedico(mascotaId: number, datos: ISolicitudRegistroMedico): Promise<IRegistroMedico>;
  obtenerHistorial(mascotaId: number): Promise<IRegistroMedico[]>;
}

export class ServicioMascotas implements IServicioMascotas {
  constructor(
    private readonly repositorioMascotas: IRepositorioMascotas,
    private readonly repositorioHistorial: IRepositorioHistorial,
    private readonly propietarios: IConsultaExistencia,
    private readonly veterinarios: IConsultaExistencia,
    private readonly reloj: IReloj
  ) {}

  public async registrarMascota(datos: INuevaMascota): Promise<IMascota> {
    const mascota: INuevaMascota = {
      propietarioId: datos.propietarioId,
      nombre: textoRequerido(datos.nombre, 'nombre', 80),
      especie: textoRequerido(datos.especie, 'especie', 40),
      raza: textoOpcional(datos.raza, 'raza', 80),
      fechaNacimiento: datos.fechaNacimiento
    };
    if (mascota.fechaNacimiento && mascota.fechaNacimiento > this.reloj.ahora()) {
      throw new ErrorValidacion('La fecha de nacimiento no puede estar en el futuro');
    }
    if (!(await this.propietarios.existe(mascota.propietarioId))) {
      throw new ErrorNoEncontrado(`El propietario ${mascota.propietarioId} no existe`);
    }
    return this.repositorioMascotas.crear(mascota);
  }

  public async obtenerMascota(id: number): Promise<IMascota> {
    const mascota = await this.repositorioMascotas.buscarPorId(id);
    if (!mascota) {
      throw new ErrorNoEncontrado(`La mascota ${id} no existe`);
    }
    return mascota;
  }

  public async existe(id: number): Promise<boolean> {
    return (await this.repositorioMascotas.buscarPorId(id)) !== null;
  }

  public async agregarRegistroMedico(mascotaId: number, datos: ISolicitudRegistroMedico): Promise<IRegistroMedico> {
    const ahora = this.reloj.ahora();
    const fecha = datos.fecha ?? ahora;
    if (fecha > ahora) {
      throw new ErrorValidacion('La fecha del registro médico no puede estar en el futuro');
    }
    const diagnostico = textoRequerido(datos.diagnostico, 'diagnostico');
    await this.obtenerMascota(mascotaId);
    if (datos.veterinarioId !== null && !(await this.veterinarios.existe(datos.veterinarioId))) {
      throw new ErrorNoEncontrado(`El veterinario ${datos.veterinarioId} no existe`);
    }
    return this.repositorioHistorial.agregar({
      mascotaId,
      veterinarioId: datos.veterinarioId,
      fecha,
      diagnostico,
      tratamiento: textoOpcional(datos.tratamiento, 'tratamiento', 5000, { multilinea: true }),
      notas: textoOpcional(datos.notas, 'notas', 5000, { multilinea: true })
    });
  }

  public async obtenerHistorial(mascotaId: number): Promise<IRegistroMedico[]> {
    await this.obtenerMascota(mascotaId);
    return this.repositorioHistorial.listarPorMascota(mascotaId);
  }
}
