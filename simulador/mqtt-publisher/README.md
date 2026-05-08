# mqtt-publisher (Simulador)

**Runtime:** Node.js  
**Responsabilidade:** Simula sensores ESP32 publicando leituras via MQTT. Usado em desenvolvimento e stress test.

## Modos de uso

**Desenvolvimento** (via docker-compose.yml principal — não incluído por padrão):
```bash
docker compose run --rm sensor-simulator
```

**Stress test** (100 sensores):
```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --scale sensor-simulator=10
# 10 instâncias × SENSORS_PER_INSTANCE(10) = 100 sensores
```

## Comportamento

- Cada instância registra N sensores com IDs opacos únicos (ex: `esp32-a4f3`)
- Publica no tópico `{LOCATION_ID}/{device_id}/{metric}` a cada `PUBLISH_INTERVAL_MS`
- Inclui `message_id` único no payload para testar a deduplicação do Ingest Service
- Injeta anomalias com probabilidade `ANOMALY_INJECTION_RATE` para testar o ML Service

## Payload publicado

```json
{
  "message_id": "uuid-v4",
  "value": 23.4,
  "unit": "celsius",
  "collected_at": "2024-01-15T10:29:59.850Z"
}
```

## Variáveis de ambiente

| Variável                | Descrição                                         |
|-------------------------|---------------------------------------------------|
| `LOCATION_ID`           | Localidade (prefixo dos tópicos)                  |
| `MQTT_BROKER_URL`       | URL do broker                                     |
| `MQTT_USERNAME`         | Usuário MQTT do simulador                         |
| `MQTT_PASSWORD`         | Senha MQTT                                        |
| `SENSORS_PER_INSTANCE`  | Número de sensores por réplica (padrão: 10)       |
| `PUBLISH_INTERVAL_MS`   | Intervalo entre publicações em ms (padrão: 500)   |
| `METRICS`               | Métricas simuladas separadas por vírgula          |
| `ANOMALY_INJECTION_RATE`| Probabilidade de anomalia por leitura (0.0 – 1.0) |
