# ingest-service

**Runtime:** NestJS  
**Responsabilidade:** Ponto de entrada dos dados. Consome mensagens MQTT do broker, deduplica via Redis e publica no stream interno.

## Streams

| Direção | Stream                 | Quando                        |
|---------|------------------------|-------------------------------|
| Produz  | `sensor.data.received` | A cada leitura válida e única |

## Dependências

- Mosquitto (subscreve em `{LOCATION_ID}/#`)
- Redis (deduplicação por `message_id` com TTL)

## Fluxo interno

```
MQTT message recebida
  → extrai message_id do payload
  → SET NX message_id no Redis com TTL
  → se duplicata: descarta
  → se único: monta envelope → XADD sensor.data.received
```
