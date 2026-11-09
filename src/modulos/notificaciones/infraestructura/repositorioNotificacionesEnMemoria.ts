import { INotificacion, INuevaNotificacion, IRepositorioNotificaciones } from '../dominio/notificacion';

export class RepositorioNotificacionesEnMemoria implements IRepositorioNotificaciones {
  private readonly notificaciones: INotificacion[] = [];
  private siguienteId = 1;

  public async registrar(notificacion: INuevaNotificacion): Promise<INotificacion> {
    const creada: INotificacion = { ...notificacion, id: this.siguienteId++ };
    this.notificaciones.push(creada);
    return { ...creada };
  }

  public async listar(limite: number): Promise<INotificacion[]> {
    return [...this.notificaciones]
      .reverse()
      .slice(0, limite)
      .map((notificacion) => ({ ...notificacion }));
  }
}
