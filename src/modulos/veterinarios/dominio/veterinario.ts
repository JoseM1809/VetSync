export interface IVeterinario {
  id: number;
  nombre: string;
  email: string;
  especialidad: string | null;
}

export type INuevoVeterinario = Omit<IVeterinario, 'id'>;

export interface IRepositorioVeterinarios {
  crear(veterinario: INuevoVeterinario): Promise<IVeterinario>;
  buscarPorId(id: number): Promise<IVeterinario | null>;
  buscarPorEmail(email: string): Promise<IVeterinario | null>;
  listar(): Promise<IVeterinario[]>;
}
