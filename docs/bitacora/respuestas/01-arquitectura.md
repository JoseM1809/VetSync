# Respuesta de la IA — Prompt 1 (Arquitectura)

> **Herramienta:** Claude Code (modelo Claude Opus 5.5), en terminal.
> **Prompt exacto:** "Actúa como un Arquitecto de Software Senior. Para el caso de uso 'VetSync', propón un esquema de base de datos relacional (MySQL) y la estructura de directorios para un backend en Node.js. Justifica tus decisiones basándote en escalabilidad y principios SOLID."
>
> Texto de la respuesta tal como la generó la IA (sin editar).

---

## 1. Decisión de estilo arquitectónico

Propongo un **monolito modular** en Node.js + TypeScript en lugar de microservicios desde el día uno:

- El dominio es pequeño (dueños, mascotas, veterinarios, citas, notificaciones) y un equipo pequeño no amortiza el costo operativo de 5 servicios (red, despliegues, trazabilidad distribuida).
- Cada módulo se organiza como un *bounded context* con sus propias capas y sólo expone **interfaces**. Si un módulo necesita escalar por separado (p. ej. notificaciones), se puede extraer a un microservicio sin reescribir el dominio, porque ya depende de abstracciones y no de otros módulos concretos.

Cada módulo sigue **arquitectura hexagonal (puertos y adaptadores)**:

| Capa | Contenido | Depende de |
|---|---|---|
| `dominio` | Entidades, reglas puras, interfaces de repositorio (puertos) | Nada |
| `aplicacion` | Casos de uso / servicios | `dominio` |
| `infraestructura` | Repositorios MySQL, repositorios en memoria, envío de correo | `dominio` |
| `http` | Rutas y controladores Express | `aplicacion` |

## 2. Esquema relacional (MySQL 8)

```sql
CREATE TABLE propietarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  telefono      VARCHAR(30)  NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE mascotas (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  propietario_id   INT UNSIGNED NOT NULL,
  nombre           VARCHAR(80)  NOT NULL,
  especie          VARCHAR(40)  NOT NULL,
  raza             VARCHAR(80)  NULL,
  fecha_nacimiento DATE         NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mascota_propietario FOREIGN KEY (propietario_id)
    REFERENCES propietarios(id) ON DELETE RESTRICT,
  INDEX idx_mascotas_propietario (propietario_id)
) ENGINE=InnoDB;

CREATE TABLE veterinarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  especialidad  VARCHAR(80)  NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE registros_medicos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mascota_id      INT UNSIGNED NOT NULL,
  veterinario_id  INT UNSIGNED NULL,
  fecha           DATETIME     NOT NULL,
  diagnostico     VARCHAR(255) NOT NULL,
  tratamiento     TEXT         NULL,
  notas           TEXT         NULL,
  CONSTRAINT fk_registro_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_registro_vet FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id),
  INDEX idx_registros_mascota_fecha (mascota_id, fecha)
) ENGINE=InnoDB;

CREATE TABLE citas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mascota_id      INT UNSIGNED NOT NULL,
  veterinario_id  INT UNSIGNED NOT NULL,
  inicio          DATETIME     NOT NULL,
  fin             DATETIME     NOT NULL,
  motivo          VARCHAR(255) NOT NULL,
  modalidad       ENUM('PRESENCIAL','TELEMEDICINA') NOT NULL DEFAULT 'PRESENCIAL',
  estado          ENUM('PROGRAMADA','CANCELADA','COMPLETADA') NOT NULL DEFAULT 'PROGRAMADA',
  recordatorio_enviado_en DATETIME NULL,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cita_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id),
  CONSTRAINT fk_cita_vet FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id),
  CONSTRAINT chk_cita_rango CHECK (fin > inicio),
  INDEX idx_citas_vet_rango (veterinario_id, inicio, fin),
  INDEX idx_citas_recordatorio (estado, inicio)
) ENGINE=InnoDB;

CREATE TABLE notificaciones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id         INT UNSIGNED NOT NULL,
  destinatario    VARCHAR(160) NOT NULL,
  asunto          VARCHAR(200) NOT NULL,
  cuerpo          TEXT         NOT NULL,
  enviado_en      DATETIME     NOT NULL,
  CONSTRAINT fk_notif_cita FOREIGN KEY (cita_id) REFERENCES citas(id),
  INDEX idx_notif_cita (cita_id)
) ENGINE=InnoDB;
```

**Justificación**

- **Normalización 3FN**: el dueño no se repite en cada mascota; el historial médico es una tabla aparte (1:N con mascota) para poder crecer sin inflar `mascotas`.
- **`inicio`/`fin` en lugar de `duracion`**: la detección de choques es una consulta de solapamiento de intervalos (`inicio < :fin AND fin > :inicio`) que aprovecha el índice compuesto `(veterinario_id, inicio, fin)`.
- **`estado` como ENUM**: una cita cancelada libera el horario sin borrarse (auditoría).
- **`recordatorio_enviado_en`** hace idempotente el envío de recordatorios: el job puede correr varias veces sin duplicar correos.
- **Tabla `notificaciones`** funciona como bitácora/outbox del correo simulado.
- **Escalabilidad**: índices alineados a las consultas reales; InnoDB para transacciones y FKs; las tablas de cada módulo no se consultan con JOIN desde otros módulos, lo que permite separar esquemas si se extrae un microservicio.

## 3. Estructura de directorios

```
vetsync/
├── AGENTS.md
├── database/
│   └── schema.sql
├── src/
│   ├── compartido/            # errores de dominio, Reloj, utilidades HTTP
│   ├── modulos/
│   │   ├── propietarios/
│   │   │   ├── dominio/       # Propietario, IRepositorioPropietarios
│   │   │   ├── aplicacion/    # ServicioPropietarios
│   │   │   ├── infraestructura/ # RepositorioPropietariosMySQL / EnMemoria
│   │   │   └── http/          # rutasPropietarios
│   │   ├── mascotas/          # incluye historial médico
│   │   ├── veterinarios/
│   │   ├── citas/
│   │   └── notificaciones/
│   ├── contenedor.ts          # composition root (inyección de dependencias)
│   ├── app.ts                 # Express
│   └── servidor.ts
├── tests/
│   ├── unit/
│   └── integracion/
└── .github/workflows/ci.yml
```

## 4. Cómo se cumplen los principios SOLID

- **S (Responsabilidad única):** controladores sólo traducen HTTP; servicios sólo orquestan reglas; repositorios sólo persisten.
- **O (Abierto/cerrado):** agregar SMS o WhatsApp = nueva clase que implementa `IServicioCorreo`/`ICanalNotificacion`, sin tocar el caso de uso.
- **L (Sustitución de Liskov):** `RepositorioCitasMySQL` y `RepositorioCitasEnMemoria` son intercambiables; los tests usan el de memoria.
- **I (Segregación de interfaces):** el servicio de citas recibe interfaces pequeñas de *lectura* de mascotas y veterinarios (`existe(id)`), no el repositorio completo.
- **D (Inversión de dependencias):** los casos de uso dependen de interfaces; las implementaciones concretas se conectan en un único `contenedor.ts`.
