/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/servidor.ts', '!src/**/infraestructura/*MySQL.ts', '!src/compartido/baseDatos.ts'],
  coverageThreshold: { global: { lines: 80, branches: 80, functions: 80, statements: 80 } }
};
