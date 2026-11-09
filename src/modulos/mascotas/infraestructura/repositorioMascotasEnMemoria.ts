import { IMascota, INuevaMascota, IRepositorioMascotas } from '../dominio/mascota';

export class RepositorioMascotasEnMemoria implements IRepositorioMascotas {
  private readonly mascotas = new Map<number, IMascota>();
  private siguienteId = 1;

  public async crear(mascota: INuevaMascota): Promise<IMascota> {
    const creada: IMascota = { ...mascota, id: this.siguienteId++ };
    this.mascotas.set(creada.id, creada);
    return { ...creada };
  }

  public async buscarPorId(id: number): Promise<IMascota | null> {
    const mascota = this.mascotas.get(id);
    return mascota ? { ...mascota } : null;
  }
}
