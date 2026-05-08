# Edge Server — TCC IoT Platform

Arquitetura distribuída para coleta, processamento e disponibilização de dados de sensores ambientais IoT.

## Estrutura do repositório

```
edge-server/
├── services/                  # Serviços de aplicação
│   ├── ingest-service/        # NestJS — recebe dados do MQTT, deduplica, publica no Redis Stream
│   ├── persistence-service/   # NestJS — consome streams, persiste no InfluxDB e Postgres
│   ├── ml-service/            # Python/FastAPI — detecção de anomalias
│   ├── notification-service/  # NestJS — gerencia alertas, aciona atuadores
│   └── actuator-service/      # NestJS — publica comandos MQTT, aguarda confirmação
│
├── simulator/
│   └── mqtt-publisher/        # Simulador de sensores para desenvolvimento e stress test
│
├── infra/                     # Infraestrutura Docker
│   ├── docker-compose.yml     # Ambiente principal
│   ├── docker-compose.test.yml# Stress test (100 sensores)
│   ├── .env.example           # Template de variáveis de ambiente
│   ├── mosquitto/             # Broker MQTT
│   ├── redis/                 # Bus de eventos interno
│   ├── postgres/              # Schema relacional
│   └── scripts/               # Scripts de setup
│
├── shared/
│   └── events/                # Schemas dos eventos Redis Streams (contratos)
│
└── docs/
    └── architecture/
        └── decisions/         # ADRs — Architecture Decision Records
```

## Como rodar

```bash
# 1. Configure o ambiente
cp infra/.env.example infra/.env
# edite infra/.env com suas senhas

# 2. Suba a infraestrutura
cd infra
docker compose up -d mosquitto redis postgres influxdb

# 3. Configure o Mosquitto
bash scripts/setup-mosquitto-passwd.sh

# 4. Suba os serviços
docker compose up -d

# Stress test (100 sensores)
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --scale sensor-simulator=10
```

## Arquitetura

Veja `docs/architecture/` para diagramas e decisões arquiteturais.
