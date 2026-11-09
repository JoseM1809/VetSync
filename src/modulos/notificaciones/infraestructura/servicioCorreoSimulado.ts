import { IRegistro } from '../../../compartido/registro';
import { IMensajeCorreo, IServicioCorreo } from '../dominio/servicioCorreo';

/** Correo simulado: no sale a internet, sólo deja constancia en el log (requerimiento 3). */
export class ServicioCorreoSimulado implements IServicioCorreo {
  constructor(private readonly registro: IRegistro) {}

  public async enviar(mensaje: IMensajeCorreo): Promise<void> {
    this.registro.info(`[CORREO SIMULADO] Para: ${mensaje.para} | Asunto: ${mensaje.asunto}`);
  }
}
