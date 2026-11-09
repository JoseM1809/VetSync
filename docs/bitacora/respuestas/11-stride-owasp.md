# Respuesta de la IA — Prompt propio 4 (Modelado de amenazas STRIDE + OWASP API Top 10)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal, con acceso al repositorio.
> **Prompt exacto:**
>
> "Actúa como especialista en Seguridad de Aplicaciones (AppSec).
> **Contexto:** VetSync es una API REST (Express 4 + MySQL) que maneja datos personales de dueños y el historial médico de sus mascotas. Por decisión de alcance de la práctica no tiene autenticación de usuarios. El código está en `src/` y las rutas en `src/modulos/*/http`.
> **Tarea:** realiza un modelado de amenazas STRIDE de la API y relaciona cada amenaza con el OWASP API Security Top 10 (2023).
> **Formato de salida:** una tabla priorizada con: amenaza, categoría STRIDE, riesgo OWASP API, evidencia (archivo y fragmento de código que la origina), severidad y mitigación. Después, separa (a) mitigaciones implementables hoy sin dependencias nuevas y en pocas líneas, y (b) las que requieren una decisión de producto.
> **Restricciones:** no reportes ninguna vulnerabilidad sin señalar el código que la origina; marca como 'no aplica' las categorías del Top 10 que no correspondan y explica por qué."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## Tabla priorizada

| # | Amenaza | STRIDE | OWASP API 2023 | Evidencia | Severidad | Mitigación |
|---|---|---|---|---|---|---|
| 1 | Cualquiera lee el historial médico de cualquier mascota recorriendo ids secuenciales | Information disclosure | API1 Broken Object Level Authorization | `rutasMascotas.ts`: `GET /:id/historial` sin verificación de dueño; ids `AUTO_INCREMENT` | Alta | (b) autenticación + autorización por dueño |
| 2 | Cualquiera cancela la cita de otra persona | Tampering | API1 BOLA | `rutasCitas.ts`: `PATCH /:id/cancelar` | Alta | (b) |
| 3 | Cualquiera dispara el job de recordatorios y lee **todos** los correos enviados (emails de todos los dueños) | Elevation of privilege / Information disclosure | API5 Broken Function Level Authorization | `rutasNotificaciones.ts`: `POST /recordatorios/ejecutar` y `GET /` sin ninguna protección | Alta | **(a)** token de administrador por cabecera |
| 4 | No hay identidad: no se puede saber quién creó o canceló una cita | Spoofing / Repudiation | API2 Broken Authentication | No existe middleware de autenticación en `app.ts` | Alta | (b) |
| 5 | Inyección de cabeceras de correo: un nombre con `\r\n` se copia al asunto | Tampering | API8 Security Misconfiguration / inyección | `validacion.ts`: `textoRequerido` sólo hace `trim()`; `servicioRecordatorios.ts`: ``asunto: `Recordatorio: cita de ${contacto.nombreMascota}` `` | Media (hoy el correo es simulado; crítica al conectar SMTP) | **(a)** rechazar caracteres de control en textos de una línea |
| 6 | Respuestas con datos médicos sin cabeceras de seguridad; un navegador o proxy puede cachearlas o interpretarlas como HTML | Information disclosure | API8 Security Misconfiguration | `app.ts`: sólo `app.disable('x-powered-by')` | Media | **(a)** `nosniff`, `Cache-Control: no-store`, CSP restrictiva |
| 7 | Sin límite de peticiones: fuerza bruta de ids y saturación | Denial of service | API4 Unrestricted Resource Consumption | `app.ts` no tiene rate limiting (sí límite de cuerpo de 100 kb y listados acotados) | Media | (b) rate limiting en el proxy o con `express-rate-limit` |
| 8 | Un actor reserva todos los horarios de un veterinario | Denial of service | API6 Unrestricted Access to Sensitive Business Flows | `servicioCitas.ts`: no hay tope de citas programadas por mascota o dueño | Media | (b) regla de negocio (p. ej. máx. 3 citas futuras por mascota) |
| 9 | API sin versión en la ruta | — | API9 Improper Inventory Management | `app.ts`: prefijo `/api` sin versión | Baja | (b) `/api/v1` |

**No aplica:** API3 (Broken Object Property Level Authorization): las respuestas no incluyen propiedades internas sensibles más allá de las ya cubiertas en #3. API7 (SSRF): la API no hace peticiones salientes a URLs del usuario. API10 (Unsafe Consumption of APIs): no consume APIs de terceros. Inyección SQL: todas las consultas usan parámetros `?`.

## (a) Implementables hoy, sin dependencias nuevas

1. **Token de administrador** (#3): variable `TOKEN_ADMIN`; las rutas de notificaciones exigen la cabecera `X-Token-Admin` y la comparan con `crypto.timingSafeEqual` para no filtrar el token por tiempos de respuesta. Si `TOKEN_ADMIN` no está configurado, esas rutas responden 401 siempre (cerradas por defecto).
2. **Caracteres de control** (#5): `textoRequerido` rechaza `\u0000–\u001F` y `\u007F` en campos de una línea; los campos multilínea (`tratamiento`, `notas`) permiten `\n` y `\t`.
3. **Cabeceras de seguridad** (#6): middleware que agrega `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y `Referrer-Policy: no-referrer`.

## (b) Requieren decisión de producto

Autenticación (JWT u OAuth) con roles dueño / veterinario / administrador (#1, #2, #4), rate limiting (#7), reglas anti-acaparamiento de horarios (#8) y versionado de la API (#9).
