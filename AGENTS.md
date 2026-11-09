# AGENTS.md — Reglas obligatorias para agentes de IA

Este archivo es la fuente de verdad para cualquier asistente de IA (Claude Code, Cursor,
Copilot, Windsurf) que genere o modifique código en este repositorio. Las reglas marcadas
como **DEBE** no son negociables; un PR que las viole se rechaza.

## 1. Lenguaje y compilador
- DEBE usarse TypeScript con `"strict": true` en `tsconfig.json`.
- DEBE compilar sin errores con `npm run build` y sin advertencias con `npm run lint`.

## 2. Nombrado
- Variables, parámetros, funciones y métodos: **camelCase** (`fechaInicio`, `agendarCita`).
- Clases, interfaces, tipos y enums: **PascalCase** (`ServicioCitas`, `EstadoCita`).
- Constantes globales inmutables: **UPPER_SNAKE_CASE** (`MINUTOS_MAXIMOS_CITA`).
- Archivos: camelCase (`servicioCitas.ts`); tests: `<nombre>.test.ts`.
- Columnas SQL en snake_case; el mapeo a camelCase ocurre sólo en la capa de infraestructura.
- PROHIBIDO usar nombres de una letra salvo índices de bucles (`i`, `j`).

## 3. Interfaces obligatorias
- Todo repositorio, servicio de aplicación y adaptador externo (correo, reloj) DEBE implementar una interfaz.
- Las interfaces se nombran con prefijo `I` (`IRepositorioCitas`).
- Las dependencias se reciben por constructor tipadas con la **interfaz**, nunca con la clase concreta.
- Las entidades y DTOs DEBEN declararse con `interface`; no se permiten objetos literales sin
  tipo explícito en firmas públicas.

## 4. Manejo de errores (try/catch en los bordes)
- `dominio` y `aplicacion` **lanzan** errores de dominio (`ErrorValidacion`, `ErrorNoEncontrado`,
  `ErrorConflicto`) pero NO los atrapan: el error debe llegar intacto al borde.
- `try/catch` es OBLIGATORIO en los bordes del sistema:
  - Infraestructura: al llamar a MySQL o al proveedor de correo, se atrapa el error del driver y,
    si tiene significado de negocio (p. ej. `ER_DUP_ENTRY`), se traduce a un error de dominio;
    en otro caso se re-lanza sin cambiarlo.
  - Transacciones: `try { commit } catch { rollback; throw } finally { release }`.
  - HTTP: los controladores se envuelven con `manejarAsync`, y un único middleware
    (`manejadorErrores`) traduce errores de dominio a 400/404/409 y el resto a 500
    sin filtrar detalles internos.
  - Procesos en segundo plano (job de recordatorios): atrapan y registran para no tumbar el proceso.
- PROHIBIDO `catch {}` vacío o que trague el error sin registrarlo ni re-lanzarlo.
- PROHIBIDO lanzar strings: siempre `throw new ErrorX(mensaje)`.
- El tipo del error en `catch (error)` es `unknown`; DEBE estrecharse con `instanceof` antes de usarse.

## 5. Prohibición de `any`
- PROHIBIDO `any`, explícito o implícito (`noImplicitAny: true`).
- ESLint DEBE tener `@typescript-eslint/no-explicit-any: "error"`.
- Para datos de origen desconocido (body HTTP, filas SQL) usar `unknown` y validarlos.
- PROHIBIDO `// @ts-ignore` y `as unknown as X` para silenciar al compilador.

## 6. Fechas
- Todas las fechas se manejan y guardan en **UTC** (ISO 8601 en la API, `timezone: 'Z'` en MySQL).
- El código de dominio NUNCA llama a `new Date()` para obtener "ahora": usa la interfaz `IReloj`.

## 7. Pruebas (TDD)
- Toda regla de negocio nueva DEBE tener primero un test que falle.
- Los tests unitarios NO DEBEN tocar la base de datos real: usan repositorios en memoria.
- Cobertura mínima: 80 % de líneas y ramas (la CI falla por debajo).

## 8. Arquitectura
- `dominio` no importa nada de `infraestructura` ni de `http`.
- Un módulo sólo importa de otro módulo a través de sus interfaces de dominio.
- Las dependencias concretas se instancian únicamente en `src/contenedor.ts`.

## 9. Seguridad
- PROHIBIDO concatenar valores en SQL: siempre consultas parametrizadas (`?`).
- PROHIBIDO commitear secretos; usar variables de entorno (`.env` está en `.gitignore`).
- Toda entrada HTTP se valida antes de llegar al caso de uso.
