/**
 * Envelope padrão dos eventos publicados pelo ingest-service no Redis Stream.
 * Deve ser mantido em sincronia com ingest-service/src/ingest/ingest.types.ts
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
