import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { IMascota, INuevaMascota, IRepositorioMascotas } from '../dominio/mascota';

interface IFilaMascota extends RowDataPacket {
  id: number;
  propietario_id: number;
  nombre: string;
  especie: string;
  raza: string | null;
  fecha_nacimiento: Date | null;
}

export class RepositorioMascotasMySQL implements IRepositorioMascotas {
  constructor(private readonly pool: Pool) {}

  public async crear(mascota: INuevaMascota): Promise<IMascota> {
    const [resultado] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO mascotas (propietario_id, nombre, especie, raza, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)',
      [mascota.propietarioId, mascota.nombre, mascota.especie, mascota.raza, mascota.fechaNacimiento]
    );
    return { ...mascota, id: resultado.insertId };
  }

  public async buscarPorId(id: number): Promise<IMascota | null> {
    const [filas] = await this.pool.execute<IFilaMascota[]>(
      'SELECT id, propietario_id, nombre, especie, raza, fecha_nacimiento FROM mascotas WHERE id = ?',
      [id]
    );
    if (filas.length === 0) {
      return null;
    }
    const fila = filas[0];
    return {
      id: fila.id,
      propietarioId: fila.propietario_id,
      nombre: fila.nombre,
      especie: fila.especie,
      raza: fila.raza,
      fechaNacimiento: fila.fecha_nacimiento
    };
  }
}
