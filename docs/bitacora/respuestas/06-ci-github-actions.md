# Respuesta de la IA — Prompt 6 (GitHub Actions)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Genera el YAML para un GitHub Action que se ejecute en cada push a 'main'. Debe instalar dependencias, correr el linter y ejecutar los tests unitarios. Falla si el coverage es menor al 80%."
>
> Archivo generado: `.github/workflows/ci.yml`.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  calidad:
    name: Lint, build y tests (cobertura >= 80 %)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Instalar dependencias
        run: npm ci

      - name: Linter (ESLint, prohíbe any)
        run: npm run lint

      - name: Compilar (TypeScript strict)
        run: npm run build

      - name: Tests unitarios + integración en memoria con cobertura
        # jest.config.js define coverageThreshold = 80 % (líneas, ramas, funciones, sentencias):
        # si la cobertura baja de 80 %, Jest termina con código distinto de 0 y el job falla.
        run: npm run test:coverage -- --ci

      - name: Publicar reporte de cobertura
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cobertura
          path: coverage/
          retention-days: 7

  integracion-mysql:
    name: Integración contra MySQL 8.4
    runs-on: ubuntu-latest
    needs: calidad
    timeout-minutes: 15
    services:
      mysql:
        image: mysql:8.4
        env:
          MYSQL_ROOT_PASSWORD: root_ci
          MYSQL_DATABASE: vetsync
          MYSQL_USER: vetsync
          MYSQL_PASSWORD: vetsync_ci
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h localhost"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=20
    env:
      PRUEBAS_MYSQL: '1'
      MYSQL_HOST: 127.0.0.1
      MYSQL_PUERTO: '3306'
      MYSQL_USUARIO: vetsync
      MYSQL_CONTRASENA: vetsync_ci
      MYSQL_BASE_DATOS: vetsync
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Instalar dependencias
        run: npm ci

      # Los contenedores de servicio arrancan ANTES del checkout, así que el esquema
      # no se puede montar como volumen: se carga aquí con el cliente mysql del runner.
      - name: Cargar esquema
        run: mysql -h 127.0.0.1 -P 3306 -uroot -proot_ci < database/schema.sql

      - name: Tests de integración MySQL (incluye prueba de concurrencia)
        run: npx jest tests/integracion/mysql.test.ts --ci
```
