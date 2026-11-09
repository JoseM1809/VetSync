import { IServicioMascotas } from '../../mascotas/aplicacion/servicioMascotas';
import { IServicioPropietarios } from '../../propietarios/aplicacion/servicioPropietarios';
import { ErrorNoEncontrado } from '../../../compartido/errores';
import { IContactoCita, IDirectorioContactos } from '../dominio/directorioContactos';

/**
 * Adaptador para el modo en memoria: arma el contacto usando los servicios públicos de
 * mascotas y propietarios. (En MySQL se usa DirectorioContactosMySQL con un solo JOIN.)
 */
export class DirectorioContactosServicios implements IDirectorioContactos {
  constructor(
    private readonly mascotas: IServicioMascotas,
    private readonly propietarios: IServicioPropietarios
  ) {}

  public async contactosDeMascotas(mascotaIds: number[]): Promise<Map<number, IContactoCita>> {
    const contactos = new Map<number, IContactoCita>();
    for (const mascotaId of mascotaIds) {
      try {
        const mascota = await this.mascotas.obtenerMascota(mascotaId);
        const propietario = await this.propietarios.obtener(mascota.propietarioId);
        contactos.set(mascotaId, {
          nombreMascota: mascota.nombre,
          nombrePropietario: propietario.nombre,
          emailPropietario: propietario.email
        });
      } catch (error: unknown) {
        // Una mascota o dueño inexistente simplemente no tiene contacto; otros errores se propagan.
        if (!(error instanceof ErrorNoEncontrado)) {
          throw error;
        }
      }
    }
    return contactos;
  }
}
