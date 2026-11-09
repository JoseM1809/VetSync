import { ErrorValidacion } from '../../../src/compartido/errores';
import { leerEnteroDelCuerpo, leerFecha } from '../../../src/compartido/http';
import { calcularIntervaloCita, LIMITES_AGENDA_POR_DEFECTO } from '../../../src/modulos/citas/dominio/politicaAgendamiento';

describe('leerFecha — fechas de calendario', () => {
  it.each(['2028-02-29T10:00:00Z', '2028-02-29', '2026-12-31T23:59:59.999Z', '2026-11-11T24:00:00Z'])('acepta %s', (valor) => {
    expect(leerFecha(valor, 'inicio')).toBeInstanceOf(Date);
  });

  it.each(['2027-02-29T10:00:00Z', '2026-04-31', '2026-02-30T10:00:00Z', '2026-00-10'])('rechaza %s', (valor) => {
    expect(() => leerFecha(valor, 'inicio')).toThrow(ErrorValidacion);
  });
});

describe('leerEnteroDelCuerpo', () => {
  it('acepta números enteros positivos y rechaza texto aunque tenga dígitos', () => {
    expect(leerEnteroDelCuerpo(7, 'id')).toBe(7);
    expect(() => leerEnteroDelCuerpo('7', 'id')).toThrow(ErrorValidacion);
  });
});

describe('calcularIntervaloCita — horizonte máximo', () => {
  const ahora = new Date('2026-11-10T15:00:00Z');
  const enDias = (dias: number, minutosExtra = 0) => new Date(ahora.getTime() + dias * 86_400_000 + minutosExtra * 60_000);

  it('permite agendar exactamente en el límite de 365 días', () => {
    expect(calcularIntervaloCita(enDias(365), 30, ahora, LIMITES_AGENDA_POR_DEFECTO).inicio).toEqual(enDias(365));
  });

  it('rechaza un minuto después del límite', () => {
    expect(() => calcularIntervaloCita(enDias(365, 1), 30, ahora, LIMITES_AGENDA_POR_DEFECTO)).toThrow(ErrorValidacion);
  });
});
