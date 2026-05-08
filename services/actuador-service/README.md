# actuator-service

**Runtime:** NestJS  
**Responsabilidade:** Recebe comandos do Notification Service, publica no tópico MQTT do dispositivo e aguarda confirmação de status.

## API HTTP (recebe do Notification Service)

```
POST /commands
Body: { device_id, command, parameters, alert_id }
```

## Streams

| Direção | Stream                        | Quando                        |
|---------|-------------------------------|-------------------------------|
| Produz  | `actuator.command.sent`       | Após publicar no MQTT         |
| Produz  | `actuator.command.confirmed`  | Após receber status do device |

## Dependências

- Mosquitto (publica em `{LOCATION_ID}/{device_id}/cmd`, subscreve em `{LOCATION_ID}/{device_id}/status`)
- Redis (publica nos streams de resultado)

## Retry policy

Aguarda confirmação por `ACTUATOR_CONFIRM_TIMEOUT_MS`. Se não receber,
reenvia até `ACTUATOR_MAX_RETRIES` vezes. Após esgotar retries,
publica `actuator.command.confirmed` com `status: "timeout"`.
