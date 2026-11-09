import { INuevoVeterinario, IRepositorioVeterinarios, IVeterinario } from '../dominio/veterinario';

export class RepositorioVeterinariosEnMemoria implements IRepositorioVeterinarios {
  private readonly veterinarios = new Map<number, IVeterinario>();
  private siguienteId = 1;

  public async crear(veterinario: INuevoVeterinario): Promise<IVeterinario> {
    const creado: IVeterinario = { ...veterinario, id: this.siguienteId++ };
    this.veterinarios.set(creado.id, creado);
    return { ...creado };
  }

  public async buscarPorId(id: number): Promise<IVeterinario | null> {
    const veterinario = this.veterinarios.get(id);
    return veterinario ? { ...veterinario } : null;
  }

  public async buscarPorEmail(email: string): Promise<IVeterinario | null> {
    const veterinario = [...this.veterinarios.values()].find((item) => item.email === email);
    return veterinario ? { ...veterinario } : null;
  }

  public async listar(): Promise<IVeterinario[]> {
    return [...this.veterinarios.values()].map((veterinario) => ({ ...veterinario }));
  }
}
