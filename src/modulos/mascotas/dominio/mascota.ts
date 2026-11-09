export interface IMascota {
  id: number;
  propietarioId: number;
  nombre: string;
  especie: string;
  raza: string | null;
  fechaNacimiento: Date | null;
}

export type INuevaMascota = Omit<IMascota, 'id'>;

export interface IRegistroMedico {
  id: number;
  mascotaId: number;
  veterinarioId: number | null;
  fecha: Date;
  diagnostico: string;
  tratamiento: string | null;
  notas: string | null;
}

export type INuevoRegistroMedico = Omit<IRegistroMedico, 'id'>;

/** Datos que envía el cliente; la fecha es opcional (por defecto, "ahora"). */
export interface ISolicitudRegistroMedico {
  veterinarioId: number | null;
  fecha: Date | null;
  diagnostico: string;
  tratamiento: string | null;
  notas: string | null;
}

export interface IRepositorioMascotas {
  crear(mascota: INuevaMascota): Promise<IMascota>;
  buscarPorId(id: number): Promise<IMascota | null>;
}

export interface IRepositorioHistorial {
  agregar(registro: INuevoRegistroMedico): Promise<IRegistroMedico>;
  /** Devuelve el historial ordenado del registro más reciente al más antiguo. */
  listarPorMascota(mascotaId: number): Promise<IRegistroMedico[]>;
}
