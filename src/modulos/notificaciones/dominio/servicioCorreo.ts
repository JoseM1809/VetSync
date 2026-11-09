export interface IMensajeCorreo {
  para: string;
  asunto: string;
  cuerpo: string;
}

/** Puerto de salida: cualquier proveedor (SMTP, SendGrid, simulado) implementa esta interfaz (OCP/DIP). */
export interface IServicioCorreo {
  enviar(mensaje: IMensajeCorreo): Promise<void>;
}
