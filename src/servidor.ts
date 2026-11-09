import 'dotenv/config';
import { crearApp } from './app';
import { cargarConfiguracion } from './compartido/configuracion';
import { RegistroConsola } from './compartido/registro';
import { RelojSistema } from './compartido/reloj';
import { construirContenedor } from './contenedor';

const registro = new RegistroConsola();
const config = cargarConfiguracion(process.env);
const contenedor = construirContenedor(config, new RelojSistema(), registro);
const app = crearApp(contenedor, registro, config.tokenAdmin);

// Job de recordatorios: borde de proceso en segundo plano, nunca debe tumbar el servidor.
const ejecutarRecordatorios = async (): Promise<void> => {
  try {
    const resumen = await contenedor.recordatorios.enviarRecordatorios();
    if (resumen.enviados + resumen.fallidos > 0) {
      registro.info(`Recordatorios: ${resumen.enviados} enviados, ${resumen.fallidos} fallidos`);
    }
  } catch (error: unknown) {
    registro.error('El job de recordatorios falló', error);
  }
};
let intervalo: NodeJS.Timeout | null = null;

const servidor = app.listen(config.puerto, () => {
  registro.info(`VetSync escuchando en http://localhost:${config.puerto} (persistencia: ${config.persistencia})`);
  // El job sólo arranca si el servidor realmente quedó escuchando.
  intervalo = setInterval(() => void ejecutarRecordatorios(), config.minutosIntervaloRecordatorios * 60_000);
});

// Sin este listener, un fallo de `listen` (p. ej. puerto ocupado) mata el proceso con un stack trace crudo.
servidor.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    registro.error(
      `El puerto ${config.puerto} ya está en uso. ¿Hay otra instancia de VetSync abierta? ` +
        `Revísalo con: Get-NetTCPConnection -LocalPort ${config.puerto} -State Listen`
    );
  } else {
    registro.error('No se pudo iniciar el servidor HTTP', error);
  }
  process.exit(1);
});

const apagar = (): void => {
  if (intervalo) {
    clearInterval(intervalo);
  }
  servidor.close(() => {
    contenedor
      .cerrar()
      .catch((error: unknown) => registro.error('Error al cerrar la conexión a la base de datos', error))
      .finally(() => process.exit(0));
  });
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
