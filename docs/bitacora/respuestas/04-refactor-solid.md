# Respuesta de la IA — Prompt 4 (Refactorización SOLID)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Revisa este bloque de código. Identifica violaciones a los principios SOLID y refactorízalo para inyectar las dependencias correctamente. Explica los cambios."
> **Bloque revisado:** `src/modulos/citas/aplicacion/servicioCitas.ts`, `src/modulos/citas/http/rutasCitas.ts` y `src/contenedor.ts` (versión que ya pasaba los 39 tests).
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## Violaciones encontradas

| # | Principio | Dónde | Problema |
|---|---|---|---|
| 1 | **DIP** | `rutasCitas.ts` → `crearRutasCitas(servicio: ServicioCitas)` | El controlador depende de la **clase concreta** `ServicioCitas`. `ServicioCitas` ni siquiera implementa una interfaz (incumple también AGENTS.md §3). No se puede sustituir por un doble de prueba ni por un decorador (caché, métricas). |
| 2 | **DIP** | `contenedor.ts` → `IContenedor` | La interfaz pública del contenedor expone `ServicioPropietarios`, `ServicioCitas`, etc. (clases). Todo consumidor de `IContenedor` (app, tests) queda acoplado a las implementaciones. |
| 3 | **SRP** | `ServicioCitas.agendarCita` | El método mezcla tres responsabilidades: (a) reglas puras del calendario (duración válida, inicio futuro, cálculo de `fin`), (b) verificación de existencia en otros módulos y (c) orquestación con el repositorio. Las reglas puras no necesitan I/O y deberían vivir en el **dominio**. |
| 4 | **OCP** | Números mágicos `240` y `31 * 24 * 3_600_000` | Cambiar la duración máxima o el rango de la agenda obliga a **modificar** el servicio. Los límites deberían ser datos inyectados. |
| 5 | **ISP** (menor) | `DirectorioContactosServicios` recibe `IServicioMascotas` completo | Sólo usa `obtenerMascota`. Se deja anotado; el costo de una interfaz extra no compensa hoy. |

## Refactorización propuesta

### 1. Reglas puras al dominio, con límites inyectables

```ts
// src/modulos/citas/dominio/politicaAgendamiento.ts
import { ErrorValidacion } from '../../../compartido/errores';

export interface ILimitesAgenda {
  duracionMaximaMinutos: number;
  rangoMaximoAgendaDias: number;
}

export const LIMITES_AGENDA_POR_DEFECTO: ILimitesAgenda = { duracionMaximaMinutos: 240, rangoMaximoAgendaDias: 31 };

export interface IIntervalo { inicio: Date; fin: Date; }

/** Valida duración e inicio futuro y calcula el intervalo [inicio, fin). Función pura: sin I/O. */
export const calcularIntervaloCita = (inicio: Date, duracionMinutos: number, ahora: Date, limites: ILimitesAgenda): IIntervalo => {
  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0 || duracionMinutos > limites.duracionMaximaMinutos) {
    throw new ErrorValidacion(`La duración debe ser un entero entre 1 y ${limites.duracionMaximaMinutos} minutos`);
  }
  if (inicio.getTime() <= ahora.getTime()) {
    throw new ErrorValidacion('No se puede agendar una cita en el pasado');
  }
  return { inicio, fin: new Date(inicio.getTime() + duracionMinutos * 60_000) };
};

export const validarRangoAgenda = (desde: Date, hasta: Date, limites: ILimitesAgenda): void => { /* ... */ };
```

### 2. Interfaz del servicio y dependencia de la abstracción

```ts
export interface IServicioCitas {
  agendarCita(solicitud: ISolicitudAgendarCita): Promise<ICita>;
  obtenerCita(id: number): Promise<ICita>;
  agendaVeterinario(veterinarioId: number, desde: Date, hasta: Date): Promise<ICita[]>;
  cancelarCita(id: number): Promise<void>;
}

export class ServicioCitas implements IServicioCitas {
  constructor(
    private readonly repositorioCitas: IRepositorioCitas,
    private readonly mascotas: IConsultaExistencia,
    private readonly veterinarios: IConsultaExistencia,
    private readonly reloj: IReloj,
    private readonly limites: ILimitesAgenda          // <- nuevo, inyectado
  ) {}

  public async agendarCita(solicitud: ISolicitudAgendarCita): Promise<ICita> {
    const { inicio, fin } = calcularIntervaloCita(solicitud.inicio, solicitud.duracionMinutos, this.reloj.ahora(), this.limites);
    await this.asegurarExistencia(solicitud.mascotaId, solicitud.veterinarioId);
    if ((await this.repositorioCitas.buscarSolapadas(solicitud.veterinarioId, inicio, fin)).length > 0) {
      throw new ErrorConflicto('El veterinario ya tiene una cita en ese horario');
    }
    return this.repositorioCitas.crear({ ...solicitud, inicio, fin });
  }
  // ...
}
```

> ⚠️ Nota: `{ ...solicitud, inicio, fin }` copia también `duracionMinutos` dentro del objeto que se envía al repositorio.

### 3. Controladores y contenedor tipados con interfaces

```ts
export const crearRutasCitas = (servicio: IServicioCitas): Router => { /* sin cambios */ };

export interface IContenedor {
  propietarios: IServicioPropietarios;
  veterinarios: IServicioVeterinarios;
  mascotas: IServicioMascotas;
  citas: IServicioCitas;
  recordatorios: IServicioRecordatorios;
  notificaciones: IRepositorioNotificaciones;
  cerrar(): Promise<void>;
}
```

## Explicación de los cambios

- **DIP:** controladores y contenedor dependen de `IServicioCitas` y demás interfaces; las clases concretas sólo aparecen dentro de `construirContenedor`.
- **SRP:** `ServicioCitas` queda como orquestador; las reglas del calendario son funciones puras del dominio, testeables sin dobles.
- **OCP:** cambiar la duración máxima o el rango es configuración (`ILimitesAgenda`), no un cambio de código.
- **Impacto en tests:** el constructor gana un 5.º parámetro; los tests existentes deben pasar `LIMITES_AGENDA_POR_DEFECTO`. El comportamiento observable no cambia, así que los 39 tests deben seguir en verde sin tocar sus aserciones.
