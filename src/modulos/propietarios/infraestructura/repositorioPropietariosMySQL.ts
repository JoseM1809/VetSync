import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { traducirErrorMySQL } from '../../../compartido/baseDatos';
import { INuevoPropietario, IPropietario, IRepositorioPropietarios } from '../dominio/propietario';

interface IFilaPropietario extends RowDataPacket {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
}

const aPropietario = (fila: IFilaPropietario): IPropietario => ({
  id: fila.id,
  nombre: fila.nombre,
  email: fila.email,
  telefono: fila.telefono
});

export class RepositorioPropietariosMySQL implements IRepositorioPropietarios {
  constructor(private readonly pool: Pool) {}

  public async crear(propietario: INuevoPropietario): Promise<IPropietario> {
    try {
      const [resultado] = await this.pool.execute<ResultSetHeader>(
        'INSERT INTO propietarios (nombre, email, telefono) VALUES (?, ?, ?)',
        [propietario.nombre, propietario.email, propietario.telefono]
      );
      return { ...propietario, id: resultado.insertId };
    } catch (error: unknown) {
      return traducirErrorMySQL(error, 'Ya existe un propietario registrado con ese email');
    }
  }

  public async buscarPorId(id: number): Promise<IPropietario | null> {
    const [filas] = await this.pool.execute<IFilaPropietario[]>(
      'SELECT id, nombre, email, telefono FROM propietarios WHERE id = ?',
      [id]
    );
    return filas.length > 0 ? aPropietario(filas[0]) : null;
  }

  public async buscarPorEmail(email: string): Promise<IPropietario | null> {
    const [filas] = await this.pool.execute<IFilaPropietario[]>(
      'SELECT id, nombre, email, telefono FROM propietarios WHERE email = ?',
      [email]
    );
    return filas.length > 0 ? aPropietario(filas[0]) : null;
  }
}
