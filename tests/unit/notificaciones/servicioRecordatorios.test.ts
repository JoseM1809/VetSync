import { ServicioRecordatorios, TAMANO_LOTE_RECORDATORIOS } from '../../../src/modulos/notificaciones/aplicacion/servicioRecordatorios';
import { IContactoCita, IDirectorioContactos } from '../../../src/modulos/notificaciones/dominio/directorioContactos';
import { IMensajeCorreo, IServicioCorreo } from '../../../src/modulos/notificaciones/dominio/servicioCorreo';
import { RepositorioNotificacionesEnMemoria } from '../../../src/modulos/notificaciones/infraestructura/repositorioNotificacionesEnMemoria';
import { RepositorioCitasEnMemoria } from '../../../src/modulos/citas/infraestructura/repositorioCitasEnMemoria';
import { crearRelojFijo } from '../../apoyo/dobles';

const AHORA = '2026-11-10T15:00:00Z';
const MASCOTA_SIN_CONTACTO = 404;

class CorreoEspia implements IServicioCorreo {
  public readonly enviados: IMensajeCorreo[] = [];

  constructor(private readonly fallarPara: string | null = null) {}

  public async enviar(mensaje: IMensajeCorreo): Promise<void> {
    if (mensaje.para === this.fallarPara) {
      throw new Error('SMTP caído');
    }
    this.enviados.push(mensaje);
  }
}

const contactos: IDirectorioContactos = {
  contactosDeMascotas: async (ids: number[]) =>
    new Map<number, IContactoCita>(
      ids
        .filter((id) => id !== MASCOTA_SIN_CONTACTO)
        .map((id): [number, IContactoCita] => [
          id,
          { nombreMascota: `Mascota ${id}`, nombrePropietario: `Dueño ${id}`, emailPropietario: `dueno${id}@correo.com` }
        ])
    )
};

describe('ServicioRecordatorios.enviarRecordatorios', () => {
  let citas: RepositorioCitasEnMemoria;
  let notificaciones: RepositorioNotificacionesEnMemoria;

  const crearCita = (mascotaId: number, inicioIso: string) =>
    citas.crear({
      mascotaId,
      veterinarioId: 10,
      inicio: new Date(inicioIso),
      fin: new Date(new Date(inicioIso).getTime() + 30 * 60_000),
      motivo: 'Consulta',
      modalidad: 'TELEMEDICINA'
    });

  const crearServicio = (correo: IServicioCorreo) =>
    new ServicioRecordatorios(citas, contactos, correo, notificaciones, crearRelojFijo(AHORA), 24);

  beforeEach(() => {
    citas = new RepositorioCitasEnMemoria();
    notificaciones = new RepositorioNotificacionesEnMemoria();
  });

  it('envía correo sólo a las citas que empiezan dentro de la ventana de 24 h', async () => {
    await crearCita(1, '2026-11-11T09:00:00Z'); // dentro de la ventana
    await crearCita(2, '2026-11-12T09:00:00Z'); // fuera de la ventana
    const correo = new CorreoEspia();

    const resumen = await crearServicio(correo).enviarRecordatorios();

    expect(resumen).toEqual({ enviados: 1, fallidos: 0 });
    expect(correo.enviados).toHaveLength(1);
    expect(correo.enviados[0].para).toBe('dueno1@correo.com');
    expect(correo.enviados[0].asunto).toContain('Mascota 1');
    expect(correo.enviados[0].cuerpo).toContain('telemedicina');
    expect(await notificaciones.listar(10)).toHaveLength(1);
  });

  it('es idempotente: no reenvía un recordatorio ya enviado', async () => {
    await crearCita(1, '2026-11-11T09:00:00Z');
    const correo = new CorreoEspia();
    const servicio = crearServicio(correo);

    await servicio.enviarRecordatorios();
    const segunda = await servicio.enviarRecordatorios();

    expect(segunda).toEqual({ enviados: 0, fallidos: 0 });
    expect(correo.enviados).toHaveLength(1);
  });

  it('no envía recordatorio de citas canceladas', async () => {
    const cita = await crearCita(1, '2026-11-11T09:00:00Z');
    await citas.actualizarEstado(cita.id, 'CANCELADA');

    expect(await crearServicio(new CorreoEspia()).enviarRecordatorios()).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('un fallo de correo o un contacto faltante no detiene el resto del lote', async () => {
    await crearCita(1, '2026-11-11T09:00:00Z');
    await crearCita(2, '2026-11-11T10:00:00Z'); // el correo de este dueño falla
    await crearCita(MASCOTA_SIN_CONTACTO, '2026-11-11T11:00:00Z');
    const correo = new CorreoEspia('dueno2@correo.com');

    const resumen = await crearServicio(correo).enviarRecordatorios();

    expect(resumen).toEqual({ enviados: 1, fallidos: 2 });
    // las fallidas siguen pendientes para reintentarse en la siguiente ejecución
    const pendientes = await citas.buscarPendientesDeRecordatorio(new Date(AHORA), new Date('2026-11-11T15:00:00Z'), 100);
    expect(pendientes.map((cita) => cita.mascotaId).sort()).toEqual([2, MASCOTA_SIN_CONTACTO]);
  });

  // ---- Agregado tras el code review: el job no debe correr dos veces en paralelo ----
  it('omite una segunda ejecución mientras la primera sigue en curso (sin correos duplicados)', async () => {
    await crearCita(1, '2026-11-11T09:00:00Z');
    let liberarCorreo: () => void = () => undefined;
    const enviados: IMensajeCorreo[] = [];
    const correoLento: IServicioCorreo = {
      enviar: (mensaje) =>
        new Promise<void>((resolver) => {
          enviados.push(mensaje);
          liberarCorreo = resolver;
        })
    };
    const servicio = crearServicio(correoLento);

    const primera = servicio.enviarRecordatorios();
    await new Promise((resolver) => setImmediate(resolver)); // la primera ya está esperando al SMTP
    const segunda = await servicio.enviarRecordatorios();
    liberarCorreo();

    expect(segunda).toEqual({ enviados: 0, fallidos: 0 });
    expect(await primera).toEqual({ enviados: 1, fallidos: 0 });
    expect(enviados).toHaveLength(1);
    // al terminar, el candado se libera y una nueva ejecución vuelve a procesar
    expect(await servicio.enviarRecordatorios()).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('procesa como máximo un lote de citas por ejecución', async () => {
    for (let i = 0; i < 3; i++) {
      await crearCita(1, `2026-11-11T0${i}:00:00Z`);
    }
    const espia = jest.spyOn(citas, 'buscarPendientesDeRecordatorio');

    await crearServicio(new CorreoEspia()).enviarRecordatorios();

    expect(espia).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), TAMANO_LOTE_RECORDATORIOS);
    expect(await citas.buscarPendientesDeRecordatorio(new Date(AHORA), new Date('2026-11-12T00:00:00Z'), 1)).toHaveLength(0);
  });
});
