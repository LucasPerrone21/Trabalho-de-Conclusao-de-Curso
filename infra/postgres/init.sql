-- =============================================================================
-- PostgreSQL — Schema inicial do Edge Server
-- Executado automaticamente na primeira inicialização do container
-- =============================================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Localidades
-- Uma instância do Edge Server serve uma localidade
-- -----------------------------------------------------------------------------
CREATE TABLE locations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(64) UNIQUE NOT NULL,  -- ex: "ufba" (igual ao LOCATION_ID)
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Devices (sensores e atuadores)
-- id opaco + alias semântico separados por design
-- -----------------------------------------------------------------------------
CREATE TABLE devices (
    id          VARCHAR(64) PRIMARY KEY,       -- identificador opaco (ex: esp32-a4f3)
    alias       VARCHAR(255) NOT NULL,         -- nome amigável (ex: "Sensor Sala 101")
    location_id UUID NOT NULL REFERENCES locations(id),
    type        VARCHAR(32) NOT NULL           -- 'sensor' | 'actuator'
                CHECK (type IN ('sensor', 'actuator')),
    status      VARCHAR(32) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'inactive', 'maintenance')),
    metadata    JSONB,                         -- campos extras sem schema fixo
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ
);

CREATE INDEX idx_devices_location ON devices(location_id);
CREATE INDEX idx_devices_type ON devices(type);

-- -----------------------------------------------------------------------------
-- Thresholds — regras estáticas de anomalia por device/métrica
-- -----------------------------------------------------------------------------
CREATE TABLE thresholds (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id   VARCHAR(64) NOT NULL REFERENCES devices(id),
    metric      VARCHAR(64) NOT NULL,          -- ex: "temperature"
    min_value   NUMERIC,                       -- NULL = sem limite inferior
    max_value   NUMERIC,                       -- NULL = sem limite superior
    severity    VARCHAR(32) NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info', 'warning', 'critical')),
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, metric)
);

-- -----------------------------------------------------------------------------
-- Alertas — registro de anomalias detectadas
-- -----------------------------------------------------------------------------
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id       VARCHAR(64) NOT NULL REFERENCES devices(id),
    metric          VARCHAR(64) NOT NULL,
    value           NUMERIC NOT NULL,
    anomaly_type    VARCHAR(64) NOT NULL,      -- 'threshold_exceeded' | 'statistical_outlier'
    severity        VARCHAR(32) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'acknowledged', 'resolved')),
    source_event_id UUID,                      -- event_id do anomaly.detected
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device ON alerts(device_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- -----------------------------------------------------------------------------
-- Comandos de atuadores — rastreabilidade completa
-- -----------------------------------------------------------------------------
CREATE TABLE actuator_commands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id       VARCHAR(64) NOT NULL REFERENCES devices(id),
    alert_id        UUID REFERENCES alerts(id),
    command         VARCHAR(64) NOT NULL,
    parameters      JSONB,
    status          VARCHAR(32) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'confirmed', 'failed', 'timeout')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,
    retries         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_commands_device ON actuator_commands(device_id);
CREATE INDEX idx_commands_alert ON actuator_commands(alert_id);

-- -----------------------------------------------------------------------------
-- Usuários — autenticação no sistema
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'operator', 'viewer')),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- =============================================================================
-- Seed inicial — Localidade padrão
-- LOCATION_ID configurado no .env deve corresponder ao slug aqui
-- =============================================================================
INSERT INTO locations (slug, name, description)
VALUES ('ufba', 'UFBA — Campus Federação', 'Localidade padrão do Edge Server')
ON CONFLICT (slug) DO NOTHING;
