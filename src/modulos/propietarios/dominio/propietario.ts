export interface IPropietario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
}

export type INuevoPropietario = Omit<IPropietario, 'id'>;

export interface IRepositorioPropietarios {
  crear(propietario: INuevoPropietario): Promise<IPropietario>;
  buscarPorId(id: number): Promise<IPropietario | null>;
  buscarPorEmail(email: string): Promise<IPropietario | null>;
}
