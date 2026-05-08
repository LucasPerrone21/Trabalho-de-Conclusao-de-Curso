# persistence-service

**Runtime:** NestJS  
**Responsabilidade:** Único serviço com acesso direto ao InfluxDB e Postgres. Persiste leituras de sensor e registros operacionais.

## Streams

| Direção  | Stream                        | Destino     |
|----------|-------------------------------|-------------|
| Consome  | `sensor.data.received`        | InfluxDB    |
| Consome  | `alert.created`               | Postgres    |
| Consome  | `actuator.command.sent`       | Postgres    |
| Consome  | `actuator.command.confirmed`  | Postgres    |

## Dependências

- Redis (consumer group nos streams acima)
- InfluxDB (batch writes de leituras temporais)
- Postgres (alertas, comandos, metadados)

## Decisão de design

É o único dono dos bancos de dados. Outros serviços que precisam ler dados
relacionais (ex: thresholds) acessam o Postgres diretamente via connection
própria — ver ADR `0004-database-access-strategy.md`.
