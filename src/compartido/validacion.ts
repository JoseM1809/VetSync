import { ErrorValidacion } from './errores';

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MAXIMA_EMAIL = 160;

// Caracteres de control (códigos 0–31 y 127): en un campo de una línea podrían inyectar cabeceras,
// p. ej. en el asunto de un correo. Los campos multilínea admiten tabulador (9) y salto de línea (10).
const TABULADOR = 9;
const SALTO_DE_LINEA = 10;
const tieneControlNoPermitido = (texto: string, multilinea: boolean): boolean =>
  [...texto].some((caracter) => {
    const codigo = caracter.charCodeAt(0);
    const esControl = codigo < 32 || codigo === 127;
    return esControl && !(multilinea && (codigo === TABULADOR || codigo === SALTO_DE_LINEA));
  });

export interface IOpcionesTexto {
  multilinea?: boolean;
}

export const textoRequerido = (valor: string, campo: string, longitudMaxima = 255, opciones: IOpcionesTexto = {}): string => {
  const limpio = valor.trim();
  if (tieneControlNoPermitido(limpio, opciones.multilinea === true)) {
    throw new ErrorValidacion(`El campo "${campo}" contiene caracteres no permitidos`);
  }
  if (limpio.length === 0) {
    throw new ErrorValidacion(`El campo "${campo}" es obligatorio`);
  }
  if (limpio.length > longitudMaxima) {
    throw new ErrorValidacion(`El campo "${campo}" admite máximo ${longitudMaxima} caracteres`);
  }
  return limpio;
};

export const textoOpcional = (
  valor: string | null,
  campo: string,
  longitudMaxima = 255,
  opciones: IOpcionesTexto = {}
): string | null => {
  if (valor === null || valor.trim().length === 0) {
    return null;
  }
  return textoRequerido(valor, campo, longitudMaxima, opciones);
};

export const emailNormalizado = (valor: string): string => {
  const email = valor.trim().toLowerCase();
  if (!PATRON_EMAIL.test(email) || email.length > LONGITUD_MAXIMA_EMAIL) {
    throw new ErrorValidacion('El email no tiene un formato válido');
  }
  return email;
};
