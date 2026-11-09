# Informe de resultados de tests — VetSync

> Fase II, paso 2 ("Implementación dirigida"): resultados de los tests y evolución del ciclo TDD.
> Herramientas: Jest 29 + ts-jest, supertest 7, MySQL 8.4 en Docker. Fecha de ejecución: 2026-11-08.

## 1. Resumen

| Métrica | Resultado |
|---|---|
| Suites | 12 en memoria + 1 contra MySQL real |
| Tests | **125 aprobados** en memoria + **2 aprobados** contra MySQL (127 en total, 0 fallidos) |
| Cobertura de líneas | **99.06 %** (umbral exigido por la CI: 80 %) |
| Cobertura de ramas | **95.70 %** |
| Linter / compilador | `eslint .` y `tsc --noEmit` sin errores ni advertencias |

Los repositorios `*MySQL.ts` se excluyen del cálculo de cobertura porque necesitan una base de datos; se prueban con la suite `tests/integracion/mysql.test.ts`
(se activa con `PRUEBAS_MYSQL=1`, y la CI la ejecuta con un contenedor MySQL).

## 2. Evolución del ciclo TDD (rojo → verde → refactor)

| Paso | Qué se hizo | Resultado |
|---|---|---|
| 1 | La IA escribe 5 tests de `agendarCita` **sin implementación** (Prompt 3) | 🔴 La suite no compila: `Cannot find module .../servicioCitas` |
| 2 | Revisión humana: se agregan 10 casos que la IA omitió (veterinario inexistente, cita que *envuelve* a otra, otro veterinario libre, cancelación libera horario, duraciones 0/-15/241/12.5, inicio = ahora) | 🔴 15 tests en rojo |
| 3 | Implementación mínima de `ServicioCitas` + repositorio en memoria | 🟢 15/15 |
| 4 | Tests de propietarios, veterinarios, mascotas/historial y recordatorios escritos antes del código | 🔴 4 suites fallan → 🟢 35/35 |
| 5 | Tests de consultas (obtener cita, agenda, cancelar dos veces) | 🔴 → 🟢 39/39 |
| 6 | Integración HTTP con supertest + configuración | 🟢 49/49, cobertura 98.6 % |
| 7 | **Refactor SOLID** (Prompt 4): interfaces, política de agendamiento pura, límites inyectados | 🟢 49/49 — sólo se agregó un argumento al constructor en los tests; ninguna aserción cambió |
| 8 | **Prueba de concurrencia contra MySQL real** (20 reservas simultáneas del mismo horario) | 🔴 **20 de 20 se guardaron** → doble reserva confirmada |
| 9 | Corrección del code review (Prompt 5): `crearSiLibre` atómico con transacción + `SELECT … FOR UPDATE`; candado del job; límites | 🟢 1 de 20 se guarda, 19 reciben conflicto; estable en 3 ejecuciones repetidas |
| 10 | Tests de motivo de cita (hueco detectado al documentar la API, Prompt 7) | 🔴 4 fallan → 🟢 55/55 |
| 11 | Demo contra MySQL: el historial respondía `…45.533Z` al crear y `…46.000Z` al leer (MySQL redondeaba). Aserción nueva en la integración MySQL | 🔴 `Expected .567Z, Received 01.000Z` → esquema con `DATETIME(3)` → 🟢 2/2 |
| 12 | Prompt propio 1 (ADR): experimento con una lectura previa al candado → doble reserva | 🔴 2 citas guardadas → solapamiento `FOR SHARE` → 🟢 1 cita; integración MySQL 3/3 |
| 13 | Prompt propio 2 (QA): matriz de 32 casos límite | 🔴 5 fallan (30-feb, 29-feb no bisiesto, año 9999, enteros como texto) → 🟢 32/32 + 11 unitarias |
| 14 | Prompt propio 4 (seguridad): token de administrador, cabeceras, caracteres de control | 🔴 no compila (falta `tokenAdmin`) → 🟢 10/10 |
| 15 | Prompt propio 5 (OpenAPI): test de contrato especificación ↔ rutas | 🟢 17/17; con una ruta inventada a propósito → 🔴 2 fallan (detecta alucinaciones) |

> Nota sobre el paso 8: la primera versión de la prueba de concurrencia usaba 5 peticiones HTTP con supertest y **pasó en verde**
> aunque el bug existía (las peticiones casi no se solapaban). Se rediseñó para llamar al servicio 20 veces en paralelo y así sí reprodujo el error.
> Un test en verde no demuestra ausencia de bugs si el test no ejerce la condición.

## 3. Salida de la ejecución en memoria (`npm run test:coverage -- --verbose`)

```text
PASS tests/unit/mascotas/servicioMascotas.test.ts
  ServicioMascotas
    √ registra una mascota de un propietario existente
    √ rechaza mascota de un propietario inexistente
    √ rechaza nombre o especie vacíos y fecha de nacimiento futura
    √ lanza 404 al obtener una mascota inexistente
    historial médico
      √ agrega registros y devuelve el historial del más reciente al más antiguo
      √ valida mascota, veterinario, diagnóstico y fecha futura
PASS tests/unit/compartido/fechasYLimites.test.ts
  leerFecha — fechas de calendario
    √ acepta 2028-02-29T10:00:00Z
    √ acepta 2028-02-29
    √ acepta 2026-12-31T23:59:59.999Z
    √ acepta 2026-11-11T24:00:00Z
    √ rechaza 2027-02-29T10:00:00Z
    √ rechaza 2026-04-31
    √ rechaza 2026-02-30T10:00:00Z
    √ rechaza 2026-00-10
  leerEnteroDelCuerpo
    √ acepta números enteros positivos y rechaza texto aunque tenga dígitos
  calcularIntervaloCita — horizonte máximo
    √ permite agendar exactamente en el límite de 365 días
    √ rechaza un minuto después del límite
PASS tests/unit/propietarios/servicioPropietarios.test.ts
  ServicioPropietarios
    √ registra un propietario y normaliza nombre y email
    √ rechaza un email con formato inválido
    √ rechaza un nombre vacío
    √ rechaza un email duplicado sin importar mayúsculas
    √ lanza ErrorNoEncontrado al obtener un propietario inexistente
    √ expone existe() para otros módulos
PASS tests/unit/citas/agendarCita.test.ts
  ServicioCitas.agendarCita
    √ agenda la cita cuando el veterinario está libre
    √ rechaza la cita si el veterinario ya está ocupado en un horario que se solapa
    √ permite una cita contigua (empieza justo cuando termina la anterior)
    √ rechaza una cita con fecha en el pasado
    √ rechaza la cita si la mascota no está registrada
    √ rechaza la cita si el veterinario no está registrado
    √ detecta el choque cuando la cita nueva envuelve por completo a una existente
    √ permite el mismo horario con un veterinario distinto
    √ una cita cancelada libera el horario
    √ rechaza una duración inválida (0 minutos)
    √ rechaza una duración inválida (-15 minutos)
    √ rechaza una duración inválida (241 minutos)
    √ rechaza una duración inválida (12.5 minutos)
    √ rechaza un inicio igual al instante actual (debe ser estrictamente futuro)
  ServicioCitas.cancelarCita
    √ lanza ErrorNoEncontrado si la cita no existe
  ServicioCitas.agendarCita - motivo (detectado al documentar la API)
    √ rechaza un motivo vacío o de más de 255 caracteres
    √ rechaza un motivo vacío o de más de 255 caracteres
    √ rechaza un motivo vacío o de más de 255 caracteres
    √ guarda el motivo sin espacios sobrantes
PASS tests/unit/veterinarios/servicioVeterinarios.test.ts
  ServicioVeterinarios
    √ registra y lista veterinarios
    √ rechaza email duplicado
    √ rechaza datos inválidos
    √ obtiene por id, lanza 404 si no existe y expone existe()
PASS tests/unit/notificaciones/servicioRecordatorios.test.ts
  ServicioRecordatorios.enviarRecordatorios
    √ envía correo sólo a las citas que empiezan dentro de la ventana de 24 h
    √ es idempotente: no reenvía un recordatorio ya enviado
    √ no envía recordatorio de citas canceladas
    √ un fallo de correo o un contacto faltante no detiene el resto del lote
    √ omite una segunda ejecución mientras la primera sigue en curso (sin correos duplicados)
    √ procesa como máximo un lote de citas por ejecución
PASS tests/unit/compartido/configuracion.test.ts
  cargarConfiguracion
    √ usa valores por defecto seguros (memoria, puerto 3000, 24 h)
    √ lee variables de MySQL
    √ rechaza valores inválidos
  adaptadores de sistema
    √ RelojSistema devuelve la hora actual
    √ RegistroConsola escribe en consola
PASS tests/unit/citas/consultasCitas.test.ts
  ServicioCitas - consultas
    √ obtiene una cita por id o lanza 404
    √ devuelve la agenda del veterinario ordenada y limitada al rango
    √ valida el rango y la existencia del veterinario en la agenda
    √ no permite cancelar una cita que ya no está programada
PASS tests/integracion/seguridad.test.ts
  Seguridad de la API
    #3 rutas de administración protegidas con token (API5)
      √ responde 401 sin cabecera
      √ responde 401 token incorrecto de la misma longitud
      √ responde 401 token incorrecto de otra longitud (no debe dar 500)
      √ permite el acceso con el token correcto
      √ cerrado por defecto: sin TOKEN_ADMIN configurado responde 403 aunque se envíe un token
      √ las rutas públicas no exigen token
    #5 caracteres de control en textos de una línea
      √ rechaza un nombre con salto de línea (inyección de cabeceras de correo)
      √ permite saltos de línea en campos multilínea (notas del historial)
    #6 cabeceras de seguridad
      √ toda respuesta incluye nosniff, no-store, CSP y Referrer-Policy
  Configuración de TOKEN_ADMIN
    √ es opcional y exige al menos 16 caracteres si se define
PASS tests/integracion/contratoOpenapi.test.ts
  Contrato OpenAPI
    √ documenta exactamente tantas operaciones como rutas tiene el código
    √ get /salud existe en la aplicación
    √ post /propietarios existe en la aplicación
    √ get /propietarios/{id} existe en la aplicación
    √ post /veterinarios existe en la aplicación
    √ get /veterinarios existe en la aplicación
    √ get /veterinarios/{id} existe en la aplicación
    √ get /veterinarios/{id}/agenda existe en la aplicación
    √ post /mascotas existe en la aplicación
    √ get /mascotas/{id} existe en la aplicación
    √ post /mascotas/{id}/historial existe en la aplicación
    √ get /mascotas/{id}/historial existe en la aplicación
    √ post /citas existe en la aplicación
    √ get /citas/{id} existe en la aplicación
    √ patch /citas/{id}/cancelar existe en la aplicación
    √ get /notificaciones existe en la aplicación
    √ post /notificaciones/recordatorios/ejecutar existe en la aplicación
PASS tests/integracion/api.test.ts
  API VetSync (integración, persistencia en memoria)
    √ responde al health check
    √ flujo completo: registro, historial, cita, choque, agenda, recordatorio y cancelación
    √ valida la entrada HTTP y devuelve 400 con mensaje claro
    √ devuelve 404 para recursos y rutas inexistentes
    √ devuelve 500 genérico sin filtrar detalles ante errores inesperados
PASS tests/integracion/particionCitas.test.ts
  POST /api/citas — partición de equivalencia y valores límite
    √ inicio válido con Z → HTTP 201
    √ inicio con offset -07:00 → HTTP 201
    √ inicio sólo con fecha (medianoche UTC) → HTTP 201
    √ inicio 1 minuto después de "ahora" (límite inferior válido) → HTTP 201
    √ inicio igual a "ahora" (límite inferior inválido) → HTTP 400
    √ inicio sin zona horaria → HTTP 400
    √ inicio en formato no ISO → HTTP 400
    √ inicio con mes 13 → HTTP 400
    √ inicio 30 de febrero (fecha inexistente) → HTTP 400
    √ inicio 29 de febrero en año no bisiesto → HTTP 400
    √ inicio en el año 9999 (fuera de horizonte) → HTTP 400
    √ inicio como número (epoch) → HTTP 400
    √ duración 1 (mínimo) → HTTP 201
    √ duración 240 (máximo) → HTTP 201
    √ duración 0 → HTTP 400
    √ duración 241 → HTTP 400
    √ duración decimal → HTTP 400
    √ duración como texto "30" → HTTP 400
    √ duración null → HTTP 400
    √ mascotaId 0 → HTTP 400
    √ mascotaId negativo → HTTP 400
    √ mascotaId mayor que el entero seguro → HTTP 400
    √ mascotaId como texto "1" → HTTP 400
    √ mascotaId inexistente → HTTP 404
    √ veterinarioId inexistente → HTTP 404
    √ modalidad TELEMEDICINA → HTTP 201
    √ modalidad en minúsculas → HTTP 400
    √ modalidad null → HTTP 400
    √ motivo de 255 caracteres (máximo) → HTTP 201
    √ motivo de 256 caracteres → HTTP 400
    √ motivo vacío → HTTP 400
    √ motivo numérico → HTTP 400
All files                                   |   98.93 |     95.7 |   99.21 |   99.06 |                   
Test Suites: 1 skipped, 12 passed, 12 of 13 total
Tests:       2 skipped, 125 passed, 127 total
Snapshots:   0 total
Time:        18.65 s
Ran all test suites.
```

### Cobertura

```text
--------------------------------------------|---------|----------|---------|---------|-------------------
File                                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------------------------------------|---------|----------|---------|---------|-------------------
All files                                   |   98.93 |     95.7 |   99.21 |   99.06 |                   
 src                                        |   96.92 |    57.14 |   85.71 |   98.36 |                   
  app.ts                                    |     100 |      100 |     100 |     100 |                   
  contenedor.ts                             |   94.87 |    57.14 |      75 |   97.22 | 103               
 src/compartido                             |   98.78 |     97.7 |     100 |   98.67 |                   
  configuracion.ts                          |     100 |      100 |     100 |     100 |                   
  errores.ts                                |     100 |      100 |     100 |     100 |                   
  http.ts                                   |   97.01 |    97.22 |     100 |   96.61 | 18-19             
  registro.ts                               |     100 |      100 |     100 |     100 |                   
  reloj.ts                                  |     100 |      100 |     100 |     100 |                   
  seguridad.ts                              |     100 |      100 |     100 |     100 |                   
  validacion.ts                             |     100 |       95 |     100 |     100 | 38                
 src/modulos/citas/aplicacion               |     100 |      100 |     100 |     100 |                   
  servicioCitas.ts                          |     100 |      100 |     100 |     100 |                   
 src/modulos/citas/dominio                  |     100 |      100 |     100 |     100 |                   
  politicaAgendamiento.ts                   |     100 |      100 |     100 |     100 |                   
 src/modulos/citas/http                     |     100 |      100 |     100 |     100 |                   
  rutasCitas.ts                             |     100 |      100 |     100 |     100 |                   
 src/modulos/citas/infraestructura          |     100 |      100 |     100 |     100 |                   
  repositorioCitasEnMemoria.ts              |     100 |      100 |     100 |     100 |                   
 src/modulos/mascotas/aplicacion            |     100 |      100 |     100 |     100 |                   
  servicioMascotas.ts                       |     100 |      100 |     100 |     100 |                   
 src/modulos/mascotas/http                  |     100 |      100 |     100 |     100 |                   
  rutasMascotas.ts                          |     100 |      100 |     100 |     100 |                   
 src/modulos/mascotas/infraestructura       |     100 |      100 |     100 |     100 |                   
  repositorioHistorialEnMemoria.ts          |     100 |      100 |     100 |     100 |                   
  repositorioMascotasEnMemoria.ts           |     100 |      100 |     100 |     100 |                   
 src/modulos/notificaciones/aplicacion      |     100 |    83.33 |     100 |     100 |                   
  servicioRecordatorios.ts                  |     100 |    83.33 |     100 |     100 | 89                
 src/modulos/notificaciones/http            |     100 |      100 |     100 |     100 |                   
  rutasNotificaciones.ts                    |     100 |      100 |     100 |     100 |                   
 src/modulos/notificaciones/infraestructura |   91.66 |        0 |     100 |   91.66 |                   
  directorioContactosServicios.ts           |   84.61 |        0 |     100 |   84.61 | 29-30             
  repositorioNotificacionesEnMemoria.ts     |     100 |      100 |     100 |     100 |                   
  servicioCorreoSimulado.ts                 |     100 |      100 |     100 |     100 |                   
 src/modulos/propietarios/aplicacion        |     100 |      100 |     100 |     100 |                   
  servicioPropietarios.ts                   |     100 |      100 |     100 |     100 |                   
 src/modulos/propietarios/http              |     100 |      100 |     100 |     100 |                   
  rutasPropietarios.ts                      |     100 |      100 |     100 |     100 |                   
 src/modulos/propietarios/infraestructura   |     100 |      100 |     100 |     100 |                   
  repositorioPropietariosEnMemoria.ts       |     100 |      100 |     100 |     100 |                   
 src/modulos/veterinarios/aplicacion        |     100 |      100 |     100 |     100 |                   
  servicioVeterinarios.ts                   |     100 |      100 |     100 |     100 |                   
 src/modulos/veterinarios/http              |     100 |      100 |     100 |     100 |                   
  rutasVeterinarios.ts                      |     100 |      100 |     100 |     100 |                   
 src/modulos/veterinarios/infraestructura   |     100 |      100 |     100 |     100 |                   
  repositorioVeterinariosEnMemoria.ts       |     100 |      100 |     100 |     100 |                   
--------------------------------------------|---------|----------|---------|---------|-------------------
```

## 4. Salida contra MySQL 8.4 real (`PRUEBAS_MYSQL=1 npx jest tests/integracion/mysql.test.ts --verbose`)

```text
PASS tests/integracion/mysql.test.ts
  API VetSync contra MySQL real
    √ persiste el flujo completo y respeta las restricciones de la base de datos
    √ no permite dos citas solapadas aunque lleguen al mismo tiempo
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        5.438 s, estimated 7 s
Ran all test suites matching /tests\\integracion\\mysql.test.ts/i.
```

## 5. Cómo reproducir

```bash
npm ci
npm run test:coverage                       # en memoria, sin base de datos
MYSQL_PUERTO=3307 docker compose up -d      # MySQL local
PRUEBAS_MYSQL=1 MYSQL_HOST=127.0.0.1 MYSQL_PUERTO=3307 MYSQL_CONTRASENA=vetsync_local   npx jest tests/integracion/mysql.test.ts
```
