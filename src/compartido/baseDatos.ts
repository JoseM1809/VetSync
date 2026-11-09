import { createPool, Pool } from 'mysql2/promise';
import { IConfiguracionMySQL } from './configuracion';
import { ErrorConflicto } from './errores';

export const crearPoolMySQL = (config: IConfiguracionMySQL): Pool =>
  createPool({
    host: config.host,
    port: config.puerto,
    user: config.usuario,
    password: config.contrasena,
    database: config.baseDatos,
    connectionLimit: 10,
    timezone: 'Z', // todas las fechas en UTC (AGENTS.md §6)
    dateStrings: false
  });

const esErrorMySQL = (error: unknown): error is Error & { code: string } =>
  error instanceof Error && typeof (error as Error & { code?: unknown }).code === 'string';

/** Traduce errores del driver con significado de negocio; el resto se re-lanza intacto. */
export const traducirErrorMySQL = (error: unknown, mensajeDuplicado: string): never => {
  if (esErrorMySQL(error) && error.code === 'ER_DUP_ENTRY') {
    throw new ErrorConflicto(mensajeDuplicado);
  }
  throw error;
};
