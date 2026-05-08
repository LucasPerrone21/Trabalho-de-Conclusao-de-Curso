# notification-service

**Runtime:** NestJS  
**Responsabilidade:** Consome anomalias detectadas, aplica lógica de cooldown, cria alertas e aciona atuadores via HTTP.

## Streams

| Direção | Stream             | Quando                             |
|---------|--------------------|------------------------------------|
| Consome | `anomaly.detected` | A cada anomalia publicada pelo ML  |
| Produz  | `alert.created`    | Quando cooldown não está ativo     |

## Comunicação síncrona

| Destino            | Protocolo | Quando                          |
|--------------------|-----------|---------------------------------|
| `actuator-service` | HTTP POST | Quando `action_required = true` |

## Dependências

- Redis (consumer group em `anomaly.detected`)
- Postgres (leitura de thresholds e configurações de cooldown)
- Actuator Service (HTTP — orquestração de comandos)
