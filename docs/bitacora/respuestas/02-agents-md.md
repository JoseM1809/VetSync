# Respuesta de la IA — Prompt 2 (AGENTS.md)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Genera un archivo agents.md estricto para un proyecto en TypeScript. Incluye reglas para: nombrado de variables en camelCase, uso obligatorio de interfaces, manejo de errores con try/catch y prohibición de usar 'any'."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

```markdown
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
- PROHIBIDO usar nombres de una letra salvo índices de bucles (`i`, `j`).

## 3. Interfaces obligatorias
- Toda clase de servicio, repositorio o adaptador externo DEBE implementar una interfaz.
- Las interfaces se nombran con prefijo `I` (`IRepositorioCitas`).
- Las dependencias se reciben por constructor tipadas con la **interfaz**, nunca con la clase concreta.
- Los objetos de datos (entidades, DTOs) DEBEN declararse con `interface`; no se permiten
  objetos literales sin tipo explícito en firmas públicas.

## 4. Manejo de errores
- Toda función `async` DEBE envolver su cuerpo en `try/catch`.
- Dentro del `catch` el error DEBE re-lanzarse como un error de dominio
  (`ErrorValidacion`, `ErrorNoEncontrado`, `ErrorConflicto`) o registrarse; nunca se ignora.
- PROHIBIDO `catch {}` vacío.
- PROHIBIDO lanzar strings: siempre `throw new ErrorX(mensaje)`.
- El tipo del error en `catch (error)` es `unknown`; DEBE estrecharse con `instanceof` antes de usarse.

## 5. Prohibición de `any`
- PROHIBIDO `any`, explícito o implícito (`noImplicitAny: true`).
- ESLint DEBE tener `@typescript-eslint/no-explicit-any: "error"`.
- Para datos de origen desconocido usar `unknown` y validarlos.
- PROHIBIDO `// @ts-ignore` y `as unknown as X` para silenciar al compilador.

## 6. Pruebas (TDD)
- Toda regla de negocio nueva DEBE tener primero un test que falle.
- Los tests unitarios NO DEBEN tocar la base de datos real: usan repositorios en memoria.
- Cobertura mínima: 80 % de líneas y ramas.

## 7. Arquitectura
- `dominio` no importa nada de `infraestructura` ni de `http`.
- Un módulo sólo importa de otro módulo a través de sus interfaces públicas.
- Las dependencias concretas se instancian únicamente en `src/contenedor.ts`.

## 8. Seguridad
- PROHIBIDO concatenar valores en SQL: siempre consultas parametrizadas (`?`).
- PROHIBIDO commitear secretos; usar variables de entorno (`.env` está en `.gitignore`).
```
