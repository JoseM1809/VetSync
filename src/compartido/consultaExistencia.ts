/** Puerto mínimo (ISP) para que un módulo verifique entidades de otro módulo sin conocer su repositorio. */
export interface IConsultaExistencia {
  existe(id: number): Promise<boolean>;
}
