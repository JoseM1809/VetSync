import { INuevoRegistroMedico, IRegistroMedico, IRepositorioHistorial } from '../dominio/mascota';

export class RepositorioHistorialEnMemoria implements IRepositorioHistorial {
  private readonly registros: IRegistroMedico[] = [];
  private siguienteId = 1;

  public async agregar(registro: INuevoRegistroMedico): Promise<IRegistroMedico> {
    const creado: IRegistroMedico = { ...registro, id: this.siguienteId++ };
    this.registros.push(creado);
    return { ...creado };
  }

  public async listarPorMascota(mascotaId: number): Promise<IRegistroMedico[]> {
    return this.registros
      .filter((registro) => registro.mascotaId === mascotaId)
      .sort((registroA, registroB) => registroB.fecha.getTime() - registroA.fecha.getTime())
      .map((registro) => ({ ...registro }));
  }
}
