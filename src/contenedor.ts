import { Pool } from 'mysql2/promise';
import { crearPoolMySQL } from './compartido/baseDatos';
import { IConfiguracion } from './compartido/configuracion';
import { IRegistro } from './compartido/registro';
import { IReloj } from './compartido/reloj';
import { IServicioCitas, ServicioCitas } from './modulos/citas/aplicacion/servicioCitas';
import { LIMITES_AGENDA_POR_DEFECTO } from './modulos/citas/dominio/politicaAgendamiento';
import { IRepositorioCitas } from './modulos/citas/dominio/repositorioCitas';
import { RepositorioCitasEnMemoria } from './modulos/citas/infraestructura/repositorioCitasEnMemoria';
import { RepositorioCitasMySQL } from './modulos/citas/infraestructura/repositorioCitasMySQL';
import { IServicioMascotas, ServicioMascotas } from './modulos/mascotas/aplicacion/servicioMascotas';
import { RepositorioHistorialEnMemoria } from './modulos/mascotas/infraestructura/repositorioHistorialEnMemoria';
import { RepositorioHistorialMySQL } from './modulos/mascotas/infraestructura/repositorioHistorialMySQL';
import { RepositorioMascotasEnMemoria } from './modulos/mascotas/infraestructura/repositorioMascotasEnMemoria';
import { RepositorioMascotasMySQL } from './modulos/mascotas/infraestructura/repositorioMascotasMySQL';
import { IServicioRecordatorios, ServicioRecordatorios } from './modulos/notificaciones/aplicacion/servicioRecordatorios';
import { IDirectorioContactos } from './modulos/notificaciones/dominio/directorioContactos';
import { ICitasPorRecordar, IRepositorioNotificaciones } from './modulos/notificaciones/dominio/notificacion';
import { DirectorioContactosMySQL } from './modulos/notificaciones/infraestructura/directorioContactosMySQL';
import { DirectorioContactosServicios } from './modulos/notificaciones/infraestructura/directorioContactosServicios';
import { RepositorioNotificacionesEnMemoria } from './modulos/notificaciones/infraestructura/repositorioNotificacionesEnMemoria';
import { RepositorioNotificacionesMySQL } from './modulos/notificaciones/infraestructura/repositorioNotificacionesMySQL';
import { ServicioCorreoSimulado } from './modulos/notificaciones/infraestructura/servicioCorreoSimulado';
import { IServicioPropietarios, ServicioPropietarios } from './modulos/propietarios/aplicacion/servicioPropietarios';
import { IRepositorioPropietarios } from './modulos/propietarios/dominio/propietario';
import { RepositorioPropietariosEnMemoria } from './modulos/propietarios/infraestructura/repositorioPropietariosEnMemoria';
import { RepositorioPropietariosMySQL } from './modulos/propietarios/infraestructura/repositorioPropietariosMySQL';
import { IServicioVeterinarios, ServicioVeterinarios } from './modulos/veterinarios/aplicacion/servicioVeterinarios';
import { IRepositorioVeterinarios } from './modulos/veterinarios/dominio/veterinario';
import { RepositorioVeterinariosEnMemoria } from './modulos/veterinarios/infraestructura/repositorioVeterinariosEnMemoria';
import { RepositorioVeterinariosMySQL } from './modulos/veterinarios/infraestructura/repositorioVeterinariosMySQL';
import { IRepositorioHistorial, IRepositorioMascotas } from './modulos/mascotas/dominio/mascota';

export interface IContenedor {
  propietarios: IServicioPropietarios;
  veterinarios: IServicioVeterinarios;
  mascotas: IServicioMascotas;
  citas: IServicioCitas;
  recordatorios: IServicioRecordatorios;
  notificaciones: IRepositorioNotificaciones;
  cerrar(): Promise<void>;
}

interface IRepositorios {
  propietarios: IRepositorioPropietarios;
  veterinarios: IRepositorioVeterinarios;
  mascotas: IRepositorioMascotas;
  historial: IRepositorioHistorial;
  citas: IRepositorioCitas & ICitasPorRecordar;
  notificaciones: IRepositorioNotificaciones;
  contactos: IDirectorioContactos | null;
}

const repositoriosEnMemoria = (): IRepositorios => ({
  propietarios: new RepositorioPropietariosEnMemoria(),
  veterinarios: new RepositorioVeterinariosEnMemoria(),
  mascotas: new RepositorioMascotasEnMemoria(),
  historial: new RepositorioHistorialEnMemoria(),
  citas: new RepositorioCitasEnMemoria(),
  notificaciones: new RepositorioNotificacionesEnMemoria(),
  contactos: null
});

const repositoriosMySQL = (pool: Pool): IRepositorios => ({
  propietarios: new RepositorioPropietariosMySQL(pool),
  veterinarios: new RepositorioVeterinariosMySQL(pool),
  mascotas: new RepositorioMascotasMySQL(pool),
  historial: new RepositorioHistorialMySQL(pool),
  citas: new RepositorioCitasMySQL(pool),
  notificaciones: new RepositorioNotificacionesMySQL(pool),
  contactos: new DirectorioContactosMySQL(pool)
});

/** Composition root: único lugar donde se instancian clases concretas (DIP). */
export const construirContenedor = (config: IConfiguracion, reloj: IReloj, registro: IRegistro): IContenedor => {
  const pool = config.persistencia === 'mysql' ? crearPoolMySQL(config.mysql) : null;
  const repos = pool ? repositoriosMySQL(pool) : repositoriosEnMemoria();

  const propietarios = new ServicioPropietarios(repos.propietarios);
  const veterinarios = new ServicioVeterinarios(repos.veterinarios);
  const mascotas = new ServicioMascotas(repos.mascotas, repos.historial, propietarios, veterinarios, reloj);
  const citas = new ServicioCitas(repos.citas, mascotas, veterinarios, reloj, LIMITES_AGENDA_POR_DEFECTO);
  const contactos = repos.contactos ?? new DirectorioContactosServicios(mascotas, propietarios);
  const recordatorios = new ServicioRecordatorios(
    repos.citas,
    contactos,
    new ServicioCorreoSimulado(registro),
    repos.notificaciones,
    reloj,
    config.horasAnticipacionRecordatorio,
    registro
  );

  return {
    propietarios,
    veterinarios,
    mascotas,
    citas,
    recordatorios,
    notificaciones: repos.notificaciones,
    cerrar: async () => {
      if (pool) {
        await pool.end();
      }
    }
  };
};
