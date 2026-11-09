import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { traducirErrorMySQL } from '../../../compartido/baseDatos';
import { INuevoVeterinario, IRepositorioVeterinarios, IVeterinario } from '../dominio/veterinario';

interface IFilaVeterinario extends RowDataPacket {
  id: number;
  nombre: string;
  email: string;
  especialidad: string | null;
}

const aVeterinario = (fila: IFilaVeterinario): IVeterinario => ({
  id: fila.id,
  nombre: fila.nombre,
  email: fila.email,
  especialidad: fila.especialidad
});

const COLUMNAS = 'id, nombre, email, especialidad';

export class RepositorioVeterinariosMySQL implements IRepositorioVeterinarios {
  constructor(private readonly pool: Pool) {}

  public async crear(veterinario: INuevoVeterinario): Promise<IVeterinario> {
    try {
      const [resultado] = await this.pool.execute<ResultSetHeader>(
        'INSERT INTO veterinarios (nombre, email, especialidad) VALUES (?, ?, ?)',
        [veterinario.nombre, veterinario.email, veterinario.especialidad]
      );
      return { ...veterinario, id: resultado.insertId };
    } catch (error: unknown) {
      return traducirErrorMySQL(error, 'Ya existe un veterinario registrado con ese email');
    }
  }

  public async buscarPorId(id: number): Promise<IVeterinario | null> {
    const [filas] = await this.pool.execute<IFilaVeterinario[]>(`SELECT ${COLUMNAS} FROM veterinarios WHERE id = ?`, [id]);
    return filas.length > 0 ? aVeterinario(filas[0]) : null;
  }

  public async buscarPorEmail(email: string): Promise<IVeterinario | null> {
    const [filas] = await this.pool.execute<IFilaVeterinario[]>(`SELECT ${COLUMNAS} FROM veterinarios WHERE email = ?`, [email]);
    return filas.length > 0 ? aVeterinario(filas[0]) : null;
  }

  public async listar(): Promise<IVeterinario[]> {
    const [filas] = await this.pool.execute<IFilaVeterinario[]>(`SELECT ${COLUMNAS} FROM veterinarios ORDER BY id`);
    return filas.map(aVeterinario);
  }
}
