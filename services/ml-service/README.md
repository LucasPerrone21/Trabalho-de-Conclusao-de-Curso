# ml-service

**Runtime:** Python / FastAPI  
**Responsabilidade:** Consome leituras de sensor e detecta anomalias. Publica resultado para o Notification Service.

## Streams

| Direção | Stream                 | Quando                          |
|---------|------------------------|---------------------------------|
| Consome | `sensor.data.received` | A cada leitura                  |
| Produz  | `anomaly.detected`     | Quando confidence >= threshold  |

## Dependências

- Redis (consumer group em `sensor.data.received`)
- Volume `ml-models` (modelos treinados persistem entre restarts)

## Tipos de anomalia

| Tipo                  | Estratégia              |
|-----------------------|-------------------------|
| `threshold_exceeded`  | Regra estática (min/max)|
| `statistical_outlier` | Z-score / Isolation Forest sobre janela deslizante |
