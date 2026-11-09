import { IRegistro, registroSilencioso } from '../../../compartido/registro';
import { IReloj } from '../../../compartido/reloj';
import { ICita } from '../../citas/dominio/cita';
import { IContactoCita, IDirectorioContactos } from '../dominio/directorioContactos';
import { ICitasPorRecordar, IRepositorioNotificaciones, IResumenRecordatorios } from '../dominio/notificacion';
import { IMensajeCorreo, IServicioCorreo } from '../dominio/servicioCorreo';

export interface IServicioRecordatorios {
  enviarRecordatorios(): Promise<IResumenRecordatorios>;
}

const MILISEGUNDOS_POR_HORA = 3_600_000;
export const TAMANO_LOTE_RECORDATORIOS = 200;

export class ServicioRecordatorios implements IServicioRecordatorios {
  constructor(
    private readonly citas: ICitasPorRecordar,
    private readonly contactos: IDirectorioContactos,
    private readonly correo: IServicioCorreo,
    private readonly notificaciones: IRepositorioNotificaciones,
    private readonly reloj: IReloj,
    private readonly horasAnticipacion: number,
    private readonly registro: IRegistro = registroSilencioso
  ) {}

  private enEjecucion = false;

  /**
   * Si ya hay una ejecución en curso (intervalo + disparo manual, o un lote lento) se omite,
   * para que dos ejecuciones no lean las mismas citas pendientes y dupliquen correos.
   */
  public async enviarRecordatorios(): Promise<IResumenRecordatorios> {
    if (this.enEjecucion) {
      this.registro.info('Recordatorios: ya hay una ejecución en curso, se omite esta');
      return { enviados: 0, fallidos: 0 };
    }
    this.enEjecucion = true;
    try {
      return await this.procesarLote();
    } finally {
      this.enEjecucion = false;
    }
  }

  private async procesarLote(): Promise<IResumenRecordatorios> {
    const ahora = this.reloj.ahora();
    const hasta = new Date(ahora.getTime() + this.horasAnticipacion * MILISEGUNDOS_POR_HORA);
    const pendientes = await this.citas.buscarPendientesDeRecordatorio(ahora, hasta, TAMANO_LOTE_RECORDATORIOS);
    if (pendientes.length === 0) {
      return { enviados: 0, fallidos: 0 };
    }

    const contactos = await this.contactos.contactosDeMascotas([...new Set(pendientes.map((cita) => cita.mascotaId))]);
    const resumen: IResumenRecordatorios = { enviados: 0, fallidos: 0 };

    for (const cita of pendientes) {
      const contacto = contactos.get(cita.mascotaId);
      if (!contacto) {
        this.registro.error(`Cita ${cita.id}: no se encontró el contacto de la mascota ${cita.mascotaId}`);
        resumen.fallidos++;
        continue;
      }
      // Borde de proceso en segundo plano: un correo fallido no debe detener el resto del lote.
      try {
        await this.enviarUno(cita, contacto, ahora);
        resumen.enviados++;
      } catch (error: unknown) {
        this.registro.error(`Cita ${cita.id}: falló el envío del recordatorio`, error);
        resumen.fallidos++;
      }
    }
    return resumen;
  }

  private async enviarUno(cita: ICita, contacto: IContactoCita, ahora: Date): Promise<void> {
    const mensaje = this.construirMensaje(cita, contacto);
    await this.correo.enviar(mensaje);
    await this.citas.marcarRecordatorioEnviado(cita.id, ahora);
    await this.notificaciones.registrar({
      citaId: cita.id,
      destinatario: mensaje.para,
      asunto: mensaje.asunto,
      cuerpo: mensaje.cuerpo,
      enviadoEn: ahora
    });
  }

  private construirMensaje(cita: ICita, contacto: IContactoCita): IMensajeCorreo {
    const modalidad = cita.modalidad === 'TELEMEDICINA' ? 'por telemedicina' : 'presencial';
    return {
      para: contacto.emailPropietario,
      asunto: `Recordatorio: cita de ${contacto.nombreMascota}`,
      cuerpo:
        `Hola ${contacto.nombrePropietario}, te recordamos la cita ${modalidad} de ${contacto.nombreMascota} ` +
        `el ${cita.inicio.toISOString()} (UTC). Motivo: ${cita.motivo}.`
    };
  }
}
