import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { cargarConfiguracion } from '../../src/compartido/configuracion';
import { registroSilencioso } from '../../src/compartido/registro';
import { construirContenedor } from '../../src/contenedor';
import { crearRelojFijo, TOKEN_ADMIN } from '../apoyo/dobles';

/**
 * Contrato: docs/openapi.yaml no puede documentar rutas que no existen ni omitir rutas que sí existen.
 * Lectura del YAML por patrones (sin dependencias): rutas con 2 espacios de sangría, métodos con 4.
 */
const raiz = join(__dirname, '..', '..');
const especificacion = readFileSync(join(raiz, 'docs', 'openapi.yaml'), 'utf8');

const operacionesDocumentadas: [string, string][] = [];
let rutaActual = '';
for (const linea of especificacion.split(/\r?\n/)) {
  const ruta = /^ {2}(\/[^:]*):\s*$/.exec(linea);
  if (ruta) {
    rutaActual = ruta[1];
    continue;
  }
  const metodo = /^ {4}(get|post|put|patch|delete):\s*$/.exec(linea);
  if (metodo && rutaActual) {
    operacionesDocumentadas.push([metodo[1], rutaActual]);
  }
}

const contarRutasEnCodigo = (): number => {
  const modulos = join(raiz, 'src', 'modulos');
  const archivosRutas = readdirSync(modulos).flatMap((modulo) =>
    readdirSync(join(modulos, modulo, 'http')).map((archivo) => join(modulos, modulo, 'http', archivo))
  );
  const enModulos = archivosRutas
    .map((archivo) => (readFileSync(archivo, 'utf8').match(/rutas\.(get|post|put|patch|delete)\(/g) ?? []).length)
    .reduce((total, cantidad) => total + cantidad, 0);
  const enApp = (readFileSync(join(raiz, 'src', 'app.ts'), 'utf8').match(/app\.(get|post|put|patch|delete)\('/g) ?? []).length;
  return enModulos + enApp;
};

describe('Contrato OpenAPI', () => {
  const app = crearApp(
    construirContenedor(cargarConfiguracion({}), crearRelojFijo('2026-11-10T15:00:00Z'), registroSilencioso),
    registroSilencioso,
    TOKEN_ADMIN
  );

  it('documenta exactamente tantas operaciones como rutas tiene el código', () => {
    expect(operacionesDocumentadas.length).toBeGreaterThan(0);
    expect(operacionesDocumentadas).toHaveLength(contarRutasEnCodigo());
  });

  it.each(operacionesDocumentadas)('%s %s existe en la aplicación', async (metodo, ruta) => {
    const url = `/api${ruta.replace(/\{[^}]+\}/g, '1')}`;
    const respuesta = await request(app)[metodo as 'get' | 'post' | 'patch'](url).set('X-Token-Admin', TOKEN_ADMIN).send({});

    // Puede ser 400/404 de negocio, pero nunca el 404 genérico de "ruta no encontrada".
    expect(respuesta.body.mensaje).not.toBe('Ruta no encontrada');
  });
});
