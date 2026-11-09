import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { INuevoRegistroMedico, IRegistroMedico, IRepositorioHistorial } from '../dominio/mascota';

interface IFilaRegistro extends RowDataPacket {
  id: number;
  mascota_id: number;
  veterinario_id: number | null;
  fecha: Date;
  diagnostico: string;
  tratamiento: string | null;
  notas: string | null;
}

export class RepositorioHistorialMySQL implements IRepositorioHistorial {
  constructor(private readonly pool: Pool) {}

  public async agregar(registro: INuevoRegistroMedico): Promise<IRegistroMedico> {
    const [resultado] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO registros_medicos (mascota_id, veterinario_id, fecha, diagnostico, tratamiento, notas) VALUES (?, ?, ?, ?, ?, ?)',
      [registro.mascotaId, registro.veterinarioId, registro.fecha, registro.diagnostico, registro.tratamiento, registro.notas]
    );
    return { ...registro, id: resultado.insertId };
  }

  public async listarPorMascota(mascotaId: number): Promise<IRegistroMedico[]> {
    const [filas] = await this.pool.execute<IFilaRegistro[]>(
      `SELECT id, mascota_id, veterinario_id, fecha, diagnostico, tratamiento, notas
         FROM registros_medicos WHERE mascota_id = ? ORDER BY fecha DESC, id DESC`,
      [mascotaId]
    );
    return filas.map((fila) => ({
      id: fila.id,
      mascotaId: fila.mascota_id,
      veterinarioId: fila.veterinario_id,
      fecha: fila.fecha,
      diagnostico: fila.diagnostico,
      tratamiento: fila.tratamiento,
      notas: fila.notas
    }));
  }
}
