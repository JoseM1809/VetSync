# Reflexión técnica: carga cognitiva y deuda técnica con IA

## ¿Dónde la IA redujo la carga cognitiva?

La reducción más clara fue en el trabajo **mecánico y de bajo riesgo**: repositorios, mapeo de filas `snake_case` a `camelCase`, rutas Express, el YAML de la CI y la especificación OpenAPI. Delegarlo nos dejó la atención libre para el dominio.

También ayudó a **explorar más rápido de lo que podríamos solos**. El prompt de QA produjo en minutos una matriz de 32 casos límite y detectó algo que no habríamos buscado: JavaScript convierte el "30 de febrero" en el 2 de marzo, así que la API agendaba citas en otro día sin avisar. El ADR comparó cinco estrategias de concurrencia, un punto de partida mucho mejor que una hoja en blanco.

Diseñar prompts con rol, contexto, tarea, restricciones y formato de salida también ayudó: cuanto más preciso el encargo, más fácil verificar la respuesta.

## ¿Dónde la aumentó?

Paradójicamente, donde la IA sonaba **más segura**. Cada respuesta llegó bien redactada, y eso obliga a distinguir lo correcto de lo plausible:

- El ADR acertó con la estrategia, pero dejó como simple advertencia algo que un experimento demostró peligroso: una sola lectura antes del candado reabría la doble reserva.
- El análisis de seguridad recomendó `timingSafeEqual` sin decir que lanza una excepción con longitudes distintas; tal cual, un token incorrecto habría dado un error 500.
- La especificación OpenAPI parecía completa y el linter le encontró 14 errores.
- En el diagnóstico del `EADDRINUSE`, la IA vio el problema del job de recordatorios, pero su código no lo corregía.

Detectar una **omisión** cuesta más que corregir un error visible, y también aumentó la carga de **verificar los propios tests**: una prueba de concurrencia pasó en verde con el bug presente, y otra mostraba "HTTP NaN" en sus títulos. Con IA es tentador leer "PASS" como "correcto".

## ¿Cómo garantizamos que el código generado no introdujera deuda técnica?

1. **Reglas ejecutables, no sólo escritas.** AGENTS.md define convenciones; ESLint y TypeScript `strict` las imponen. Cuando ESLint rechazó una expresión regular, se reescribió el código en vez de desactivar la regla.
2. **TDD como contrato.** Cada corrección empezó con un test en rojo. Hoy son 127 pruebas y 99 % de cobertura de líneas.
3. **Verificación contra el sistema real.** Las afirmaciones de la IA sobre MySQL se comprobaron con transacciones simultáneas reales, no por confianza.
4. **Tests que vigilan a la IA.** Un test de contrato compara la especificación OpenAPI con las rutas del código; con una ruta inventada a propósito, falla.
5. **Puerta automática en la CI**: lint, compilación, tests y cobertura mínima del 80 % en cada push.
6. **Deuda explícita.** Lo que se decidió no hacer (autenticación, rate limiting) quedó documentado con su motivo.

La conclusión: la IA acelera la *escritura* de código, pero no la *responsabilidad* sobre él. El humano decide qué es correcto y prueba que lo es.
