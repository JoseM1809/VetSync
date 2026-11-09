export interface IContactoCita {
  nombreMascota: string;
  nombrePropietario: string;
  emailPropietario: string;
}

/**
 * Resuelve en lote el contacto (dueño) de varias mascotas.
 * Se pide en lote a propósito para evitar el problema N+1 en el job de recordatorios.
 */
export interface IDirectorioContactos {
  contactosDeMascotas(mascotaIds: number[]): Promise<Map<number, IContactoCita>>;
}
