import { IConsultaExistencia } from '../../src/compartido/consultaExistencia';
import { IReloj } from '../../src/compartido/reloj';

export const TOKEN_ADMIN = 'token-admin-de-pruebas-123456';

export const crearRelojFijo = (iso: string): IReloj => ({ ahora: () => new Date(iso) });

export const crearConsulta = (idsExistentes: number[]): IConsultaExistencia => ({
  existe: async (id: number) => idsExistentes.includes(id)
});
