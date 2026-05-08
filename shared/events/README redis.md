# Contratos dos Eventos — Redis Streams

Todos os eventos seguem o mesmo envelope. O campo `payload` varia por tipo.

## Envelope padrão

```json
{
  "event_id":   "uuid-v4",
  "event_type": "sensor.data.received",
  "source":     "ingest-service",
  "location_id":"ufba",
  "timestamp":  "2024-01-15T10:30:00.000Z",
  "version":    "1.0",
  "payload":    {}
}
```

---

## sensor.data.received

**Stream:** `sensor.data.received`  
**Produzido por:** ingest-service  
**Consumido por:** persistence-service, ml-service  

```json
{
  "event_id":    "550e8400-e29b-41d4-a716-446655440000",
  "event_type":  "sensor.data.received",
  "source":      "ingest-service",
  "location_id": "ufba",
  "timestamp":   "2024-01-15T10:30:00.000Z",
  "version":     "1.0",
  "payload": {
    "device_id":    "esp32-a4f3",
    "metric":       "temperature",
    "value":        23.4,
    "unit":         "celsius",
    "collected_at": "2024-01-15T10:29:59.850Z"
  }
}
```

> `timestamp` = quando o evento entrou no sistema  
> `collected_at` = quando o sensor mediu (divergem em reconexões offline)

---

## anomaly.detected

**Stream:** `anomaly.detected`  
**Produzido por:** ml-service  
**Consumido por:** notification-service  

```json
{
  "event_id":    "...",
  "event_type":  "anomaly.detected",
  "source":      "ml-service",
  "location_id": "ufba",
  "timestamp":   "2024-01-15T10:30:01.200Z",
  "version":     "1.0",
  "payload": {
    "device_id":    "esp32-a4f3",
    "metric":       "temperature",
    "value":        23.4,
    "anomaly_type": "threshold_exceeded",
    "severity":     "warning",
    "confidence":   0.94,
    "context": {
      "threshold_min":  null,
      "threshold_max":  22.0,
      "window_avg":     21.2
    }
  }
}
```

> `anomaly_type`: `threshold_exceeded` | `statistical_outlier`  
> `confidence`: notification-service só alerta se >= `ML_ANOMALY_CONFIDENCE_THRESHOLD`

---

## alert.created

**Stream:** `alert.created`  
**Produzido por:** notification-service  
**Consumido por:** persistence-service, actuator-service  

```json
{
  "event_id":    "...",
  "event_type":  "alert.created",
  "source":      "notification-service",
  "location_id": "ufba",
  "timestamp":   "2024-01-15T10:30:01.500Z",
  "version":     "1.0",
  "payload": {
    "alert_id":        "uuid-do-alerta",
    "device_id":       "esp32-a4f3",
    "metric":          "temperature",
    "severity":        "warning",
    "anomaly_event_id":"uuid-do-evento-de-anomalia",
    "action_required": true,
    "action_type":     "actuator_command"
  }
}
```

---

## actuator.command.sent

**Stream:** `actuator.command.sent`  
**Produzido por:** actuator-service  
**Consumido por:** persistence-service  

```json
{
  "event_id":    "...",
  "event_type":  "actuator.command.sent",
  "source":      "actuator-service",
  "location_id": "ufba",
  "timestamp":   "2024-01-15T10:30:02.000Z",
  "version":     "1.0",
  "payload": {
    "command_id": "uuid-do-comando",
    "device_id":  "atuador-01",
    "command":    "set_threshold",
    "parameters": { "max_temp": 20.0 },
    "alert_id":   "uuid-do-alerta",
    "mqtt_topic": "ufba/atuador-01/cmd",
    "status":     "sent"
  }
}
```

---

## actuator.command.confirmed

**Stream:** `actuator.command.confirmed`  
**Produzido por:** actuator-service  
**Consumido por:** persistence-service  

```json
{
  "event_id":    "...",
  "event_type":  "actuator.command.confirmed",
  "source":      "actuator-service",
  "location_id": "ufba",
  "timestamp":   "2024-01-15T10:30:03.500Z",
  "version":     "1.0",
  "payload": {
    "command_id":       "uuid-do-comando",
    "device_id":        "atuador-01",
    "status":           "confirmed",
    "device_timestamp": "2024-01-15T10:30:03.200Z"
  }
}
```

> `status`: `confirmed` | `timeout` | `failed`
