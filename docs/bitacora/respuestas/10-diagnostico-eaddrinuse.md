# Respuesta de la IA — Prompt propio 3 (Diagnóstico de un fallo real al arrancar)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal, con acceso al repositorio.
> **Prompt exacto:**
>
> "Actúa como Ingeniero de Soporte de Producción experto en Node.js sobre Windows.
> **Contexto:** al ejecutar `npm start` para VetSync (Windows 11, Node 24, puerto 3010 configurado en `.env`) el proceso terminó con la salida de abajo. Minutos antes, el mismo servidor se había ejecutado como tarea en segundo plano y esa tarea se detuvo.
> ```
> node:events:487
>       throw er; // Unhandled 'error' event
>       ^
> Error: listen EADDRINUSE: address already in use :::3010
>     at Server.setupListenHandle [as _listen2] (node:net:2167:16)
>     at app.listen (…\node_modules\express\lib\application.js:635:24)
>     at Object.<anonymous> (…\dist\servidor.js:13:22)
> Emitted 'error' event on Server instance at: …
>   code: 'EADDRINUSE', errno: -4091, syscall: 'listen', address: '::', port: 3010
> ```
> **Tarea:** 1) indica las 3 causas raíz más probables, ordenadas, con el comando exacto de PowerShell para confirmar o descartar cada una; 2) explica por qué el proceso termina con un stack trace en lugar de un mensaje claro; 3) propone el cambio mínimo en `src/servidor.ts` para que este fallo sea diagnosticable sin ocultar el error.
> **Restricción:** no sugieras terminar procesos de forma indiscriminada (por ejemplo, todos los `node.exe`)."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## 1. Causas raíz más probables

**Causa 1 (más probable): la instancia anterior de VetSync sigue viva.** En Windows, detener el proceso padre (la tarea, la consola o `npm`) no siempre termina al proceso hijo `node`: no hay señales POSIX que se propaguen al árbol de procesos. El `node dist/servidor.js` anterior queda huérfano y conserva el puerto.

```powershell
$c = Get-NetTCPConnection -LocalPort 3010 -State Listen
Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" | Select-Object ProcessId, ExecutablePath, CommandLine
```
Si la línea de comandos es `node dist/servidor.js` (o `ts-node src/servidor.ts`), es esta causa. Se termina **ese PID**, no todos los `node.exe`: `Stop-Process -Id <PID>`.

**Causa 2: otra aplicación usa el puerto 3010.** El mismo comando mostrará otro ejecutable (otro servidor de desarrollo, un proxy). Solución: cambiar `PUERTO` en `.env`.

**Causa 3 (poco probable aquí): el puerto está en un rango reservado por Windows.** Hyper-V, WSL y Docker Desktop reservan rangos de puertos dinámicamente.
```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```
Este caso suele producir `EACCES` (permiso denegado) y no `EADDRINUSE`, por eso queda en tercer lugar.

## 2. Por qué termina con un stack trace

`app.listen()` devuelve un `http.Server`, que es un `EventEmitter`. Cuando el `listen` falla, Node emite el evento `'error'`. Un `EventEmitter` que emite `'error'` **sin ningún listener** lanza la excepción: de ahí el `Unhandled 'error' event`. Como ocurre fuera de cualquier `try/catch` (es asíncrono), el proceso muere con el stack trace crudo. Además, en el código actual el `setInterval` del job de recordatorios se programa antes de saber si el servidor arrancó.

## 3. Cambio mínimo propuesto en `src/servidor.ts`

```ts
const servidor = app.listen(config.puerto, () => {
  registro.info(`VetSync escuchando en http://localhost:${config.puerto} (persistencia: ${config.persistencia})`);
});

servidor.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    registro.error(
      `El puerto ${config.puerto} ya está en uso. ¿Hay otra instancia de VetSync abierta? ` +
        `Revísalo con: Get-NetTCPConnection -LocalPort ${config.puerto} -State Listen`
    );
  } else {
    registro.error('No se pudo iniciar el servidor HTTP', error);
  }
  process.exit(1);
});
```

El error no se oculta: se registra con una pista accionable y el proceso termina con código 1, para que un supervisor o la CI lo detecten como fallo.
