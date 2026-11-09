/** Errores de dominio. El middleware HTTP los traduce a códigos de estado. */
export abstract class ErrorDominio extends Error {
  public abstract readonly codigoHttp: number;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorValidacion extends ErrorDominio {
  public readonly codigoHttp = 400;
}

export class ErrorNoEncontrado extends ErrorDominio {
  public readonly codigoHttp = 404;
}

export class ErrorConflicto extends ErrorDominio {
  public readonly codigoHttp = 409;
}

export class ErrorNoAutorizado extends ErrorDominio {
  public readonly codigoHttp = 401;
}

export class ErrorProhibido extends ErrorDominio {
  public readonly codigoHttp = 403;
}
