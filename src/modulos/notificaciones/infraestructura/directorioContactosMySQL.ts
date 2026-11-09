import { Pool, RowDataPacket } from 'mysql2/promise';
import { IContactoCita, IDirectorioContactos } from '../dominio/directorioContactos';

interface IFilaContacto extends RowDataPacket {
  mascota_id: number;
  nombre_mascota: string;
  nombre_propietario: string;
  email_propietario: string;
}

/** Resuelve todos los contactos del lote con un único JOIN (evita N+1). */
export class DirectorioContactosMySQL implements IDirectorioContactos {
  constructor(private readonly pool: Pool) {}

  public async contactosDeMascotas(mascotaIds: number[]): Promise<Map<number, IContactoCita>> {
    if (mascotaIds.length === 0) {
      return new Map();
    }
    // `query` (no `execute`) porque mysql2 sólo expande arrays en IN (?) con escape del lado cliente.
    const [filas] = await this.pool.query<IFilaContacto[]>(
      `SELECT m.id AS mascota_id, m.nombre AS nombre_mascota, p.nombre AS nombre_propietario, p.email AS email_propietario
         FROM mascotas m JOIN propietarios p ON p.id = m.propietario_id
        WHERE m.id IN (?)`,
      [mascotaIds]
    );
    return new Map(
      filas.map((fila): [number, IContactoCita] => [
        fila.mascota_id,
        { nombreMascota: fila.nombre_mascota, nombrePropietario: fila.nombre_propietario, emailPropietario: fila.email_propietario }
      ])
    );
  }
}
