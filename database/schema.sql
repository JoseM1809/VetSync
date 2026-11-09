-- VetSync - esquema MySQL 8.0.16+ (los CHECK se ignoran en versiones anteriores).
-- Todas las fechas se guardan en UTC y con milisegundos (DATETIME(3)): sin fracción, MySQL redondea
-- al segundo y la API devolvería al leer un valor distinto del que respondió al crear.

CREATE DATABASE IF NOT EXISTS vetsync CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE vetsync;

CREATE TABLE IF NOT EXISTS propietarios (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL,
  telefono   VARCHAR(30)  NULL,
  creado_en  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_propietarios_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS veterinarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  especialidad  VARCHAR(80)  NULL,
  creado_en     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_veterinarios_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mascotas (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  propietario_id   INT UNSIGNED NOT NULL,
  nombre           VARCHAR(80)  NOT NULL,
  especie          VARCHAR(40)  NOT NULL,
  raza             VARCHAR(80)  NULL,
  fecha_nacimiento DATE         NULL,
  creado_en        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_mascota_propietario FOREIGN KEY (propietario_id) REFERENCES propietarios(id) ON DELETE RESTRICT,
  INDEX idx_mascotas_propietario (propietario_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registros_medicos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mascota_id      INT UNSIGNED NOT NULL,
  veterinario_id  INT UNSIGNED NULL,
  fecha           DATETIME(3)     NOT NULL,
  diagnostico     VARCHAR(255) NOT NULL,
  tratamiento     TEXT         NULL,
  notas           TEXT         NULL,
  CONSTRAINT fk_registro_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_registro_vet FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id) ON DELETE SET NULL,
  INDEX idx_registros_mascota_fecha (mascota_id, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS citas (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mascota_id              INT UNSIGNED NOT NULL,
  veterinario_id          INT UNSIGNED NOT NULL,
  inicio                  DATETIME(3)     NOT NULL,
  fin                     DATETIME(3)     NOT NULL,
  motivo                  VARCHAR(255) NOT NULL,
  modalidad               ENUM('PRESENCIAL','TELEMEDICINA') NOT NULL DEFAULT 'PRESENCIAL',
  estado                  ENUM('PROGRAMADA','CANCELADA','COMPLETADA') NOT NULL DEFAULT 'PROGRAMADA',
  recordatorio_enviado_en DATETIME(3)     NULL,
  creado_en               DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_cita_mascota FOREIGN KEY (mascota_id) REFERENCES mascotas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cita_vet FOREIGN KEY (veterinario_id) REFERENCES veterinarios(id) ON DELETE RESTRICT,
  CONSTRAINT chk_cita_rango CHECK (fin > inicio),
  -- Búsqueda de choques: WHERE veterinario_id = ? AND estado = 'PROGRAMADA' AND inicio < ? AND fin > ?
  INDEX idx_citas_vet_estado_inicio (veterinario_id, estado, inicio),
  -- Job de recordatorios: WHERE estado = 'PROGRAMADA' AND recordatorio_enviado_en IS NULL AND inicio BETWEEN ...
  INDEX idx_citas_recordatorio (estado, recordatorio_enviado_en, inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificaciones (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id       INT UNSIGNED NOT NULL,
  destinatario  VARCHAR(160) NOT NULL,
  asunto        VARCHAR(200) NOT NULL,
  cuerpo        TEXT         NOT NULL,
  enviado_en    DATETIME(3)     NOT NULL,
  CONSTRAINT fk_notif_cita FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE,
  INDEX idx_notif_cita (cita_id),
  INDEX idx_notif_enviado (enviado_en)
) ENGINE=InnoDB;
