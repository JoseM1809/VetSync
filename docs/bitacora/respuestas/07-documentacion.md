# Respuesta de la IA — Prompt 7 (Documentación autónoma)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal, con acceso de lectura a todo el repositorio.
> **Prompt exacto:**
>
> "Actúa como un Ingeniero de Software Principal y Arquitecto de Soluciones experto en documentación técnica. Tu objetivo es generar la documentación completa y profesional de un proyecto basándote en el código fuente, la estructura de archivos y los detalles técnicos que te proporcionaré a continuación.
> Debes generar dos entregables principales en bloques de código independientes:
> i. El archivo `README.md` principal del proyecto.
> ii. La documentación técnica detallada de la API.
> ### CONTEXTO DEL PROYECTO
> VetSync, backend Node.js 22 + TypeScript + Express 4 + MySQL 8.4 (mysql2). Monolito modular hexagonal con 5 módulos (propietarios, veterinarios, mascotas con historial, citas, notificaciones). Persistencia intercambiable memoria/MySQL vía `PERSISTENCIA`. Job de recordatorios cada 5 min con ventana de 24 h. Tests con Jest + supertest; CI en GitHub Actions. El código fuente está en `src/` (lee las rutas en `src/modulos/*/http`)."
>
> **Entregables generados (texto íntegro en el repositorio):**
> - [`README.md`](../../../README.md)
> - [`docs/API.md`](../../API.md)

## Hallazgo durante la revisión humana

Al revisar la tabla de campos de `POST /citas`, la IA dejó la columna de reglas de `motivo` con un guion ("—"),
porque el código efectivamente **no validaba** ese campo. La documentación fue fiel al código, pero el código tenía un hueco:
un motivo vacío se aceptaba y uno de más de 255 caracteres habría causado un error 500 en MySQL (`VARCHAR(255)`).
Se escribió primero el test (4 casos en rojo), luego la validación (`textoRequerido(motivo, 'motivo', 255)`) y se actualizó `API.md`.
