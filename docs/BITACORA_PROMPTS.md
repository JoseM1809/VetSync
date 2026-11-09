# Bitácora de Prompts — VetSync

- **Asignación:** Ingeniería de Software Potenciada por IA
- **Caso:** VetSync — Gestión de Citas y Telemedicina Veterinaria
- **Herramienta principal:** Claude Code (CLI en terminal), modelo **Claude Opus 5.5**, con acceso al repositorio local (lectura/escritura de archivos y ejecución de `npm`, `jest`, `eslint`, `docker`).

Se listan los **5 prompts más complejos** del proyecto. Todos son prompts propios, diseñados para este caso y ejecutados sobre el código real. Para cada uno se incluye el prompt exacto, la herramienta, un extracto de la respuesta de la IA (el texto íntegro está en el Anexo A) y la crítica humana. Los prompts sugeridos por la actividad también se usaron, en la construcción inicial del sistema; se resumen en el Anexo B.

## Estructura de los prompts

Cada prompt sigue la misma estructura, para que la IA no tenga que adivinar el contexto ni el formato:

| Elemento | Propósito |
|---|---|
| **Rol** | Fija el punto de vista experto (arquitecto, QA, AppSec, soporte, diseño de APIs) |
| **Contexto** | Stack, archivos relevantes y estado del sistema, para que la respuesta se base en el código real |
| **Tarea** | Qué se pide, en pasos numerados |
| **Restricciones** | Qué no debe hacer (inventar, modificar producción, matar procesos), para reducir alucinaciones |
| **Formato de salida** | Secciones o artefacto exacto, para poder verificar la respuesta |

## Resumen

| # | Fase | Prompt | Resultado clave de la revisión humana |
|---|---|---|---|
| 1 | I – Arquitectura | ADR: estrategias contra la doble reserva | Un experimento demostró que la opción recomendada era frágil: una lectura previa reabre la doble reserva |
| 2 | II – TDD / QA | Partición de equivalencia y valores límite | 32 casos; 5 fallaron en el código real (30 de febrero se convertía en 2 de marzo) |
| 3 | II – Caza de bugs | Diagnóstico de un `EADDRINUSE` real | Causa confirmada con evidencia; la IA detectó un problema pero su código no lo corregía |
| 4 | III – Seguridad | STRIDE + OWASP API Top 10 | Recomendó `timingSafeEqual` sin advertir que lanza excepción si las longitudes difieren |
| 5 | III – Documentación | Contrato OpenAPI 3.1 desde el código | La especificación "completa" no pasó el linter (14 errores → 0 tras la corrección); se creó un test que detecta rutas inventadas |

---

## Prompt 1 — Decisión de arquitectura: estrategia contra la doble reserva

**Prompt exacto**
> Actúa como Arquitecto de Software Principal especializado en sistemas transaccionales.
> **Contexto:** VetSync es un backend Node.js 22 + TypeScript + MySQL 8.4 (InnoDB, aislamiento por defecto) organizado como monolito modular hexagonal. La regla de negocio crítica es: un veterinario no puede tener dos citas en estado PROGRAMADA cuyos intervalos [inicio, fin) se solapen, aunque las peticiones lleguen al mismo tiempo. Las citas duran entre 1 y 240 minutos y pueden empezar en cualquier minuto.
> **Tarea:** redacta un Architecture Decision Record en formato MADR que compare al menos cuatro estrategias para garantizar esa invariante.
> **Para cada opción indica:** el mecanismo exacto en MySQL, el nivel de aislamiento que requiere, qué recibe el segundo cliente cuando dos peticiones compiten, el impacto en rendimiento y cómo se probaría.
> **Restricciones:** no propongas cambiar de motor de base de datos; cita únicamente comportamientos documentados de InnoDB.
> **Formato de salida:** Markdown con las secciones Contexto, Factores de decisión, Opciones, Comparación (tabla), Decisión y Consecuencias.

**Herramienta:** Claude Code (Claude Opus 5.5).

**Respuesta de la IA (extracto)** — texto completo en el Anexo A.1
- Comparó 5 opciones: (A) candado `SELECT … FOR UPDATE` por veterinario, (B) aislamiento `SERIALIZABLE`, (C) tabla de franjas con `UNIQUE`, (D) candados con nombre `GET_LOCK` y (E) concurrencia optimista con versión.
- Afirmó que con `SERIALIZABLE` el perdedor recibe un *deadlock* 1213 y que la opción A responde 409 sin reintentos.
- Recomendó la opción A con esta advertencia: *"La consulta de solapamiento DEBE ejecutarse dentro de la misma transacción y después del `FOR UPDATE`."*
- Sobre `GET_LOCK`: *"si el proceso cae con la conexión viva el candado sigue tomado"*.

**Crítica — qué se cambió, por qué y qué alucinaciones hubo**

| Hallazgo | Tipo | Cómo se detectó | Decisión |
|---|---|---|---|
| `SERIALIZABLE` produce deadlock 1213 | Correcto | Experimento con dos transacciones reales en MySQL 8.4: una recibió `ER_LOCK_DEADLOCK`. | Se descartó la opción B. |
| Opción A con `FOR UPDATE` como primera sentencia | Correcto | Experimento: 1 cita guardada, la otra transacción recibe conflicto. | Se mantuvo. |
| La advertencia "después del `FOR UPDATE`" es cierta, pero la IA la dejó como **regla de disciplina** sin medir el riesgo | Riesgo subestimado | Experimento A-bis: con una sola lectura previa al candado, **las dos transacciones guardaron la cita**. InnoDB fija la "foto" de los datos en la primera lectura simple. | La consulta de solapamiento se volvió lectura con candado (`… LIMIT 1 FOR SHARE`), que siempre ve lo último confirmado. Verificado: 1 cita y 409 incluso con lectura previa; integración 3 veces en verde. |
| `GET_LOCK` "con el proceso caído y la conexión viva" | Afirmación contradictoria | Lectura crítica: si el proceso cae, la conexión se cierra y MySQL libera el candado. El riesgo real es devolver la conexión al pool sin `RELEASE_LOCK`. | Corregido en el ADR final. |

**Resultado:** `docs/adr/0001-evitar-doble-reserva.md` (aceptado), con una tabla de 5 experimentos y un cambio de una línea en `repositorioCitasMySQL.ts`.

---

## Prompt 2 — Diseño de pruebas: partición de equivalencia y valores límite

**Prompt exacto**
> Actúa como Ingeniero de QA especializado en diseño de casos de prueba.
> **Contexto:** en VetSync, `POST /api/citas` recibe JSON; la capa HTTP lo convierte con `leerFecha`, `leerEnteroPositivo` y `leerModalidad` (`src/compartido/http.ts`, `src/modulos/citas/http/rutasCitas.ts`) y después `ServicioCitas.agendarCita` aplica las reglas de negocio (`src/modulos/citas`). Usa un reloj fijo en `2026-11-10T15:00:00Z`.
> **Tarea:** aplica partición de equivalencia y análisis de valores límite a los campos `inicio`, `duracionMinutos`, `mascotaId`, `veterinarioId`, `modalidad` y `motivo`.
> **Entregables:** 1) una matriz con clase de equivalencia, valor representativo y código HTTP esperado según el contrato de la API; 2) la lista de casos que el código actual probablemente maneja mal, con el valor exacto que lo demuestra; 3) un archivo de pruebas Jest + supertest parametrizado con `it.each` que cubra la matriz.
> **Restricciones:** no modifiques código de producción; cada caso debe cambiar un solo campo respecto de una solicitud válida.

**Herramienta:** Claude Code (Claude Opus 5.5).

**Respuesta de la IA (extracto)** — texto completo y código en el Anexo A.2
- Matriz de 32 casos (12 de `inicio`, 7 de duración, 6 de ids, 3 de modalidad, 4 de motivo).
- Cuatro sospechas: `Date.parse` convierte `2027-02-30` en el 2 de marzo; lo mismo con el 29 de febrero de un año no bisiesto; no hay horizonte máximo (se acepta el año 9999); el cuerpo acepta números como texto (`"30"`).
- Archivo `tests/integracion/particionCitas.test.ts` con `it.each`.

**Crítica**

| Hallazgo | Tipo | Cómo se detectó | Decisión |
|---|---|---|---|
| Las 4 sospechas eran reales | Acierto | Al ejecutar los tests: **5 fallos exactamente en esos casos** (27 de 32 pasaban). Una cita del "30 de febrero" se habría agendado el 2 de marzo sin avisar. | `leerFecha` verifica que la fecha exista; horizonte de 365 días configurable en `ILimitesAgenda`; `leerEnteroDelCuerpo` exige números JSON. Resultado: 32/32. |
| Los títulos de los tests decían `→ HTTP NaN` | Error en el código generado | Salida de Jest: el orden de la tupla `[nombre, cambios, esperado]` no coincidía con el formato `'%s → HTTP %i'`. Los tests evaluaban bien, pero el reporte era ilegible. | Se reordenó la tupla a `[nombre, esperado, cambios]`. |
| Faltaba el caso válido del 29 de febrero bisiesto y el borde exacto del horizonte | Omisión | Revisión de la matriz: sin ellos, la corrección del calendario podía romper fechas válidas sin que nada fallara. | Tests unitarios: `2028-02-29` aceptado; 365 días aceptado, 365 días + 1 minuto rechazado. |
| Respetó la restricción de no tocar producción | Correcto | Revisión del diff. | — |

---

## Prompt 3 — Caza de bugs: diagnóstico de un fallo real al arrancar

**Prompt exacto**
> Actúa como Ingeniero de Soporte de Producción experto en Node.js sobre Windows.
> **Contexto:** al ejecutar `npm start` para VetSync (Windows 11, Node 24, puerto 3010 configurado en `.env`) el proceso terminó con la salida de abajo. Minutos antes, el mismo servidor se había ejecutado como tarea en segundo plano y esa tarea se detuvo.
> ```
> Error: listen EADDRINUSE: address already in use :::3010
>     at Server.setupListenHandle [as _listen2] (node:net:2167:16)
>     at app.listen (…\node_modules\express\lib\application.js:635:24)
>     at Object.<anonymous> (…\dist\servidor.js:13:22)
> Emitted 'error' event on Server instance at: …
> ```
> **Tarea:** 1) indica las 3 causas raíz más probables, ordenadas, con el comando exacto de PowerShell para confirmar o descartar cada una; 2) explica por qué el proceso termina con un stack trace en lugar de un mensaje claro; 3) propone el cambio mínimo en `src/servidor.ts` para que este fallo sea diagnosticable sin ocultar el error.
> **Restricción:** no sugieras terminar procesos de forma indiscriminada (por ejemplo, todos los `node.exe`).

**Herramienta:** Claude Code (Claude Opus 5.5).

**Respuesta de la IA (extracto)** — texto completo en el Anexo A.3
- Causas: (1) la instancia anterior quedó huérfana, porque en Windows detener el proceso padre no siempre termina al hijo `node`; (2) otra aplicación usa el puerto; (3) un rango de puertos reservado por Hyper-V/Docker, aclarando que eso suele dar `EACCES` y no `EADDRINUSE`.
- Comandos `Get-NetTCPConnection` + `Get-CimInstance Win32_Process` para identificar el PID, y terminar sólo ese PID.
- Causa del stack trace: el `http.Server` emite `'error'` sin ningún *listener*. Propuso `servidor.on('error', …)` con un mensaje accionable y `process.exit(1)`.
- Observó que el job de recordatorios se programa antes de saber si el servidor arrancó.

**Crítica**

| Hallazgo | Tipo | Cómo se detectó | Decisión |
|---|---|---|---|
| Causa 1 | Correcta y confirmada | Evidencia de esta misma sesión: el comando propuesto mostró el PID 32492 con `node dist/servidor.js`, huérfano de la tarea detenida. Se terminó **sólo** ese PID. | — |
| La IA detectó que el job arranca aunque el servidor falle, pero **su código propuesto no lo corrige** | Hueco entre diagnóstico y solución | Lectura del código sugerido: el `setInterval` seguía fuera del callback de `listen`. | El job se programa dentro del callback de `listen`, es decir, sólo si el servidor quedó escuchando. |
| El cambio propuesto funciona | Verificado | Se ocupó el puerto 3011 con un proceso de prueba y se arrancó VetSync ahí: mensaje claro con el comando de diagnóstico y código de salida 1. | Aplicado. |
| Causa 3 (`EACCES` vs `EADDRINUSE`) | No verificada | No se reprodujo un rango reservado en esta sesión. | Se registra como afirmación no comprobada. |

---

## Prompt 4 — Seguridad: modelado de amenazas STRIDE + OWASP API Top 10

**Prompt exacto**
> Actúa como especialista en Seguridad de Aplicaciones (AppSec).
> **Contexto:** VetSync es una API REST (Express 4 + MySQL) que maneja datos personales de dueños y el historial médico de sus mascotas. Por decisión de alcance de la práctica no tiene autenticación de usuarios. El código está en `src/` y las rutas en `src/modulos/*/http`.
> **Tarea:** realiza un modelado de amenazas STRIDE de la API y relaciona cada amenaza con el OWASP API Security Top 10 (2023).
> **Formato de salida:** una tabla priorizada con: amenaza, categoría STRIDE, riesgo OWASP API, evidencia (archivo y fragmento de código que la origina), severidad y mitigación. Después, separa (a) mitigaciones implementables hoy sin dependencias nuevas y en pocas líneas, y (b) las que requieren una decisión de producto.
> **Restricciones:** no reportes ninguna vulnerabilidad sin señalar el código que la origina; marca como 'no aplica' las categorías del Top 10 que no correspondan y explica por qué.

**Herramienta:** Claude Code (Claude Opus 5.5).

**Respuesta de la IA (extracto)** — texto completo en el Anexo A.4
- 9 amenazas priorizadas. Las más graves: lectura de historiales por ids secuenciales (API1), cancelar citas ajenas (API1), y rutas de notificaciones abiertas que exponen el email de todos los dueños (API5).
- Hallazgo no obvio: un nombre con `\r\n` llega al asunto del correo, lo que permitiría inyectar cabeceras al conectar un SMTP real.
- (a) Implementables hoy: token de administrador comparado con `crypto.timingSafeEqual` (*"si `TOKEN_ADMIN` no está configurado, esas rutas responden 401 siempre"*), rechazo de caracteres de control y cabeceras de seguridad. (b) Decisiones de producto: autenticación con roles, rate limiting, límite de citas por mascota y versionado.

**Crítica**

| Hallazgo | Tipo | Cómo se detectó | Decisión |
|---|---|---|---|
| Cada amenaza señala código real | Correcto | Se revisaron las 9 contra el código: todas existen. | — |
| `timingSafeEqual` **lanza una excepción si las longitudes difieren**; la IA no lo advirtió | Omisión técnica | Prueba directa en Node: `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`. Implementado tal cual, un token de otra longitud habría producido un **500** en vez de un 401. | Se comparan huellas SHA-256 (siempre 32 bytes). Test: "token de otra longitud → 401". |
| "Sin token configurado responde 401" | Código HTTP impreciso | 401 sugiere que otra credencial funcionaría, pero ninguna puede funcionar. | Se usa **403** (ruta deshabilitada). |
| Expresión regular de caracteres de control | Problema al implementar | ESLint (`no-control-regex`) la rechazó. | En lugar de desactivar la regla, se validó por código de carácter. |
| Mitigaciones de tipo (b) | Decisión | Fuera del alcance de la práctica. | Documentadas en el README como limitaciones. |

**Resultado:** `src/compartido/seguridad.ts` y 10 tests de seguridad (cabeceras, 401/403, inyección de saltos de línea).

---

## Prompt 5 — Documentación: contrato OpenAPI 3.1 a partir del código

**Prompt exacto**
> Actúa como Arquitecto de APIs especializado en diseño *contract-first*.
> **Contexto:** VetSync es una API Express; las rutas están en `src/modulos/*/http`, la validación de entrada en `src/compartido/http.ts` y `src/compartido/validacion.ts`, los errores en `src/compartido/errores.ts`, la seguridad en `src/compartido/seguridad.ts` y las reglas de citas en `src/modulos/citas/dominio/politicaAgendamiento.ts`.
> **Tarea:** genera la especificación OpenAPI 3.1 completa (`docs/openapi.yaml`) que describa exactamente el comportamiento implementado: rutas, parámetros, cuerpos con tipos y restricciones (longitudes, rangos, formatos, enumeraciones), respuestas con todos sus códigos, el esquema de error común y el esquema de seguridad de las rutas de administración.
> **Restricciones:** no documentes campos ni códigos de estado que el código no implemente; si el código y `docs/API.md` discrepan, gana el código y enumera las discrepancias al final.
> **Formato de salida:** YAML válido con componentes reutilizables en `components`.

**Herramienta:** Claude Code (Claude Opus 5.5).

**Respuesta de la IA (extracto)** — especificación completa en el Anexo A.5
- 16 operaciones, 16 esquemas, 6 respuestas reutilizables y el esquema de seguridad `X-Token-Admin`.
- 6 discrepancias con `API.md`: faltaban los códigos 401/403 y el token, el horizonte de 365 días, la validación de calendario, los enteros como números JSON y la regla de caracteres de control.

**Crítica**

| Hallazgo | Tipo | Cómo se detectó | Decisión |
|---|---|---|---|
| La especificación se veía completa pero **no era válida** | Error | Redocly CLI: **14 errores y 9 advertencias**. Las advertencias visibles: 6 etiquetas sin descripción y 2 operaciones sin respuesta 4xx. | Se agregaron descripciones a las etiquetas y `security: []` a las 14 operaciones públicas (los 14 errores coincidían en número). **Segunda ejecución del linter: 0 errores** ("Your API description is valid"), lo que confirma la causa. Quedan 3 advertencias aceptadas: el servidor `localhost` (es el de desarrollo) y las dos de abajo. |
| Advertencia "operación sin respuesta 4xx" en `GET /salud` y `GET /veterinarios` | Decisión | Esas rutas no producen errores 4xx. | Se aceptan las advertencias: agregar un 4xx sería documentar algo falso, lo que la propia restricción prohíbe. |
| Las 6 discrepancias | Correctas | Cada una se verificó contra el código. | `docs/API.md` actualizado. |
| Riesgo de rutas alucinadas | Prevención | Se creó `tests/integracion/contratoOpenapi.test.ts`: compara las operaciones del YAML con las rutas del código y llama a cada una. **Prueba de mutación:** al agregar una ruta inventada (`/citas/{id}/reprogramar`), el test falla. | Ninguna ruta inventada en la especificación real (17/17). |

---

## Anexo B — Prompts sugeridos por la actividad (construcción inicial)

Se usaron para construir la primera versión del sistema. Las respuestas íntegras están en `docs/bitacora/respuestas/01` a `07`.

| # | Fase | Prompt sugerido | Hallazgo principal de la revisión |
|---|---|---|---|
| S1 | I | "Actúa como un Arquitecto de Software Senior… propón un esquema de base de datos relacional (MySQL) y la estructura de directorios…" | Omitió la concurrencia y las zonas horarias; usó `DATETIME` sin milisegundos (MySQL los redondeaba). |
| S2 | I | "Genera un archivo agents.md estricto para un proyecto en [Lenguaje]…" | La regla "try/catch en toda función async" convertiría errores 500 en 400; se cambió a "try/catch en los bordes" y se reforzó con ESLint. |
| S3 | II | "Escribe 5 casos de prueba unitarios usando Jest para la función 'agendarCita'…" | Faltaban 10 casos de borde, entre ellos la cita que envuelve a otra. |
| S4 | II | "Revisa este bloque de código. Identifica violaciones a los principios SOLID…" | Correcto en DIP/SRP/OCP; se rechazó un *spread* que filtraba un campo extra al JSON. |
| S5 | III | "Actúa como un experto en Ciberseguridad y Rendimiento…" | Detectó la doble reserva (20 de 20 guardadas en MySQL real); un falso positivo y una alternativa engañosa. |
| S6 | III | "Genera el YAML para un GitHub Action que se ejecute en cada push a 'main'…" | Se verificó que el umbral de cobertura del 80 % sí rompe el build. |
| S7 | III | "Actúa como un Ingeniero de Software Principal y Arquitecto de Soluciones experto en documentación técnica…" | Al documentar se descubrió que `motivo` no se validaba. |
