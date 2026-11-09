import { INuevoPropietario, IPropietario, IRepositorioPropietarios } from '../dominio/propietario';

export class RepositorioPropietariosEnMemoria implements IRepositorioPropietarios {
  private readonly propietarios = new Map<number, IPropietario>();
  private siguienteId = 1;

  public async crear(propietario: INuevoPropietario): Promise<IPropietario> {
    const creado: IPropietario = { ...propietario, id: this.siguienteId++ };
    this.propietarios.set(creado.id, creado);
    return { ...creado };
  }

  public async buscarPorId(id: number): Promise<IPropietario | null> {
    const propietario = this.propietarios.get(id);
    return propietario ? { ...propietario } : null;
  }

  public async buscarPorEmail(email: string): Promise<IPropietario | null> {
    const propietario = [...this.propietarios.values()].find((item) => item.email === email);
    return propietario ? { ...propietario } : null;
  }
}
