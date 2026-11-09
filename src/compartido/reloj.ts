/** Abstracción del tiempo para que las reglas de negocio sean testeables. */
export interface IReloj {
  ahora(): Date;
}

export class RelojSistema implements IReloj {
  public ahora(): Date {
    return new Date();
  }
}
