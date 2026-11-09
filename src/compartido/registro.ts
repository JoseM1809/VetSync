/** Abstracción de logging para no acoplar los casos de uso a `console`. */
export interface IRegistro {
  info(mensaje: string): void;
  error(mensaje: string, error?: unknown): void;
}

export class RegistroConsola implements IRegistro {
  public info(mensaje: string): void {
    console.log(`[INFO] ${new Date().toISOString()} ${mensaje}`);
  }

  public error(mensaje: string, error?: unknown): void {
    const detalle = error instanceof Error ? error.message : String(error ?? '');
    console.error(`[ERROR] ${new Date().toISOString()} ${mensaje} ${detalle}`.trim());
  }
}

export const registroSilencioso: IRegistro = {
  info: () => undefined,
  error: () => undefined
};
