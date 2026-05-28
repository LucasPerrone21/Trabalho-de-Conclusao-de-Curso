/**
 * Envelope padrão dos eventos publicados nos Redis Streams.
 * Deve ser mantido em sincronia com shared/events/README redis.md
 */
export interface SensorDataEvent {
  event_id: string;
  event_type: 'sensor.data.received';
  source: 'ingest-service';
  location_id: string;
  timestamp: string;
  version: '1.0';
  payload: {
    device_id: string;
    metric: string;
    value: number;
    unit: string;
    collected_at: string;
  };
}

/**
 * Payload bruto recebido via MQTT do simulador/dispositivo.
 */
export interface MqttPayload {
  message_id: string;
  value: number;
  unit: string;
  collected_at: string;
}

export const SENSOR_STREAM = 'sensor.data.received';
