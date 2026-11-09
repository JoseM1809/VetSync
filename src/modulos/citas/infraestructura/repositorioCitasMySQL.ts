import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ICitasPorRecordar } from '../../notificaciones/dominio/notificacion';
import { EstadoCita, ICita, INuevaCita, ModalidadCita } from '../dominio/cita';
import { IRepositorioCitas } from '../dominio/repositorioCitas';

interface IFilaCita extends RowDataPacket {
  id: number;
  mascota_id: number;
  veterinario_id: number;
  inicio: Date;
  fin: Date;
  motivo: string;
  modalidad: ModalidadCita;
  estado: EstadoCita;
  recordatorio_enviado_en: Date | null;
}

const COLUMNAS = 'id, mascota_id, veterinario_id, inicio, fin, motivo, modalidad, estado, recordatorio_enviado_en';

const aCita = (fila: IFilaCita): ICita => ({
  id: fila.id,
  mascotaId: fila.mascota_id,
  veterinarioId: fila.veterinario_id,
  inicio: fila.inicio,
  fin: fila.fin,
  motivo: fila.motivo,
  modalidad: fila.modalidad,
  estado: fila.estado,
  recordatorioEnviadoEn: fila.recordatorio_enviado_en
});

export class RepositorioCitasMySQL implements IRepositorioCitas, ICitasPorRecordar {
  constructor(private readonly pool: Pool) {}

  /**
   * Verificación de choque + inserción en una sola transacción (corrige la condición de carrera
   * detectada en el code review). `SELECT ... FOR UPDATE` sobre la fila del veterinario serializa
   * las reservas del MISMO veterinario sin bloquear las de otros.
   */
  public async crearSiLibre(cita: INuevaCita): Promise<ICita | null> {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.execute('SELECT id FROM veterinarios WHERE id = ? FOR UPDATE', [cita.veterinarioId]);
      // FOR SHARE = lectura con candado: siempre ve lo último confirmado, aunque la transacción
      // ya tuviera una "foto" previa de los datos (ver docs/adr/0001, escenario A-bis).
      const [solapadas] = await conexion.execute<RowDataPacket[]>(
        `SELECT id FROM citas
          WHERE veterinario_id = ? AND estado = 'PROGRAMADA' AND inicio < ? AND fin > ?
          LIMIT 1 FOR SHARE`,
        [cita.veterinarioId, cita.fin, cita.inicio]
      );
      if (solapadas.length > 0) {
        await conexion.rollback();
        return null;
      }
      const [resultado] = await conexion.execute<ResultSetHeader>(
        'INSERT INTO citas (mascota_id, veterinario_id, inicio, fin, motivo, modalidad) VALUES (?, ?, ?, ?, ?, ?)',
        [cita.mascotaId, cita.veterinarioId, cita.inicio, cita.fin, cita.motivo, cita.modalidad]
      );
      await conexion.commit();
      return { ...cita, id: resultado.insertId, estado: 'PROGRAMADA', recordatorioEnviadoEn: null };
    } catch (error: unknown) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  public async buscarPorId(id: number): Promise<ICita | null> {
    const [filas] = await this.pool.execute<IFilaCita[]>(`SELECT ${COLUMNAS} FROM citas WHERE id = ?`, [id]);
    return filas.length > 0 ? aCita(filas[0]) : null;
  }

  public async listarPorVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]> {
    const [filas] = await this.pool.execute<IFilaCita[]>(
      `SELECT ${COLUMNAS} FROM citas WHERE veterinario_id = ? AND inicio >= ? AND inicio < ? ORDER BY inicio`,
      [veterinarioId, desde, hasta]
    );
    return filas.map(aCita);
  }

  public async actualizarEstado(id: number, estado: EstadoCita): Promise<void> {
    await this.pool.execute('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
  }

  public async buscarPendientesDeRecordatorio(desde: Date, hasta: Date, limite: number): Promise<ICita[]> {
    const [filas] = await this.pool.execute<IFilaCita[]>(
      `SELECT ${COLUMNAS} FROM citas
        WHERE estado = 'PROGRAMADA' AND recordatorio_enviado_en IS NULL AND inicio > ? AND inicio <= ?
        ORDER BY inicio
        LIMIT ?`,
      [desde, hasta, String(limite)]
    );
    return filas.map(aCita);
  }

  public async marcarRecordatorioEnviado(citaId: number, fecha: Date): Promise<void> {
    await this.pool.execute('UPDATE citas SET recordatorio_enviado_en = ? WHERE id = ?', [fecha, citaId]);
  }
}
