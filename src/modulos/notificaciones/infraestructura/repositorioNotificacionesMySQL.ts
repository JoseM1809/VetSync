import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { INotificacion, INuevaNotificacion, IRepositorioNotificaciones } from '../dominio/notificacion';

interface IFilaNotificacion extends RowDataPacket {
  id: number;
  cita_id: number;
  destinatario: string;
  asunto: string;
  cuerpo: string;
  enviado_en: Date;
}

export class RepositorioNotificacionesMySQL implements IRepositorioNotificaciones {
  constructor(private readonly pool: Pool) {}

  public async registrar(notificacion: INuevaNotificacion): Promise<INotificacion> {
    const [resultado] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO notificaciones (cita_id, destinatario, asunto, cuerpo, enviado_en) VALUES (?, ?, ?, ?, ?)',
      [notificacion.citaId, notificacion.destinatario, notificacion.asunto, notificacion.cuerpo, notificacion.enviadoEn]
    );
    return { ...notificacion, id: resultado.insertId };
  }

  public async listar(limite: number): Promise<INotificacion[]> {
    // LIMIT con placeholder: mysql2 exige el número como string en sentencias preparadas.
    const [filas] = await this.pool.execute<IFilaNotificacion[]>(
      'SELECT id, cita_id, destinatario, asunto, cuerpo, enviado_en FROM notificaciones ORDER BY enviado_en DESC, id DESC LIMIT ?',
      [String(limite)]
    );
    return filas.map((fila) => ({
      id: fila.id,
      citaId: fila.cita_id,
      destinatario: fila.destinatario,
      asunto: fila.asunto,
      cuerpo: fila.cuerpo,
      enviadoEn: fila.enviado_en
    }));
  }
}
