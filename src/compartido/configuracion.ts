import { ErrorValidacion } from './errores';

export type ModoPersistencia = 'memoria' | 'mysql';

export interface IConfiguracionMySQL {
  host: string;
  puerto: number;
  usuario: string;
  contrasena: string;
  baseDatos: string;
}

export interface IConfiguracion {
  puerto: number;
  persistencia: ModoPersistencia;
  mysql: IConfiguracionMySQL;
  horasAnticipacionRecordatorio: number;
  minutosIntervaloRecordatorios: number;
  /** Token para las rutas de administración; null = esas rutas quedan cerradas. */
  tokenAdmin: string | null;
}

const LONGITUD_MINIMA_TOKEN = 16;

const leerTokenAdmin = (entorno: IVariablesEntorno): string | null => {
  const token = entorno.TOKEN_ADMIN;
  if (token === undefined || token === '') {
    return null;
  }
  if (token.length < LONGITUD_MINIMA_TOKEN) {
    throw new ErrorValidacion(`TOKEN_ADMIN debe tener al menos ${LONGITUD_MINIMA_TOKEN} caracteres`);
  }
  return token;
};

type IVariablesEntorno = Record<string, string | undefined>;

const leerNumero = (entorno: IVariablesEntorno, nombre: string, porDefecto: number): number => {
  const valor = entorno[nombre];
  if (valor === undefined || valor === '') {
    return porDefecto;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new ErrorValidacion(`La variable de entorno ${nombre} debe ser un número positivo`);
  }
  return numero;
};

export const cargarConfiguracion = (entorno: IVariablesEntorno): IConfiguracion => {
  const persistencia = entorno.PERSISTENCIA ?? 'memoria';
  if (persistencia !== 'memoria' && persistencia !== 'mysql') {
    throw new ErrorValidacion('PERSISTENCIA debe ser "memoria" o "mysql"');
  }
  return {
    puerto: leerNumero(entorno, 'PUERTO', 3000),
    persistencia,
    mysql: {
      host: entorno.MYSQL_HOST ?? 'localhost',
      puerto: leerNumero(entorno, 'MYSQL_PUERTO', 3306),
      usuario: entorno.MYSQL_USUARIO ?? 'vetsync',
      contrasena: entorno.MYSQL_CONTRASENA ?? '',
      baseDatos: entorno.MYSQL_BASE_DATOS ?? 'vetsync'
    },
    horasAnticipacionRecordatorio: leerNumero(entorno, 'HORAS_ANTICIPACION_RECORDATORIO', 24),
    minutosIntervaloRecordatorios: leerNumero(entorno, 'MINUTOS_INTERVALO_RECORDATORIOS', 5),
    tokenAdmin: leerTokenAdmin(entorno)
  };
};
