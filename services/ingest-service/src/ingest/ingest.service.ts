import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import {
  MqttPayload,
  SENSOR_STREAM,
  SensorDataEvent,
} from './ingest.types';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Processa uma mensagem MQTT recebida.
   *
   * @param topic - Tópico MQTT no formato {location_id}/{device_id}/{metric}
   * @param rawPayload - Payload JSON recebido do dispositivo/simulador
   */
  async handleMessage(topic: string, rawPayload: Buffer | object): Promise<void> {
    // 1. Parse do tópico → extrai device_id e metric
    const parts = topic.split('/');
    if (parts.length !== 3) {
      this.logger.warn(`Ignoring malformed topic: ${topic}`);
      return;
    }
    const [, deviceId, metric] = parts;

    // 2. Parse do payload JSON
    // O @nestjs/microservices com MQTT já deserializa automaticamente payloads JSON
    // antes de entregar ao handler. Tratamos ambos os casos (Buffer e objeto) para robustez.
    let payload: MqttPayload;
    try {
      if (Buffer.isBuffer(rawPayload)) {
        payload = JSON.parse(rawPayload.toString()) as MqttPayload;
      } else if (typeof rawPayload === 'string') {
        payload = JSON.parse(rawPayload) as MqttPayload;
      } else {
        payload = rawPayload as MqttPayload;
      }
    } catch {
      this.logger.warn(`Invalid JSON payload on topic ${topic}`);
      return;
    }

    if (!payload.message_id || payload.value === undefined) {
      this.logger.warn(`Missing required fields on topic ${topic}`);
      return;
    }

    // 3. Deduplicação — descarta mensagens já vistas
    const isNew = await this.redis.markIfNew(
      payload.message_id,
      this.config.dedupTtlSeconds,
    );
    if (!isNew) {
      this.logger.debug(`Duplicate message_id=${payload.message_id} — discarded`);
      return;
    }

    // 4. Verificação / auto-registro do device
    await this.ensureDeviceExists(deviceId);

    // 5. Monta envelope de evento e publica no Redis Stream
    const event: SensorDataEvent = {
      event_id: uuidv4(),
      event_type: 'sensor.data.received',
      source: 'ingest-service',
      location_id: this.config.locationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      payload: {
        device_id: deviceId,
        metric,
        value: payload.value,
        unit: payload.unit,
        collected_at: payload.collected_at,
      },
    };

    const streamId = await this.redis.publishToStream(SENSOR_STREAM, {
      data: JSON.stringify(event),
    });

    this.logger.debug(
      `Published | stream=${SENSOR_STREAM} id=${streamId} device=${deviceId} metric=${metric} value=${payload.value}`,
    );

    // 6. Atualiza last_seen_at em background (fire-and-forget)
    void this.db.touchDevice(deviceId).catch((err) =>
      this.logger.error(`Failed to touch device ${deviceId}`, err),
    );
  }

  /**
   * Verifica se o device existe no cache (Redis) ou no banco (Postgres).
   * Se não existir em nenhum, auto-registra com status 'pending'.
   */
  private async ensureDeviceExists(deviceId: string): Promise<void> {
    // Cache hit — caminho feliz, sem I/O adicional
    if (await this.redis.isDeviceCached(deviceId)) {
      return;
    }

    // Cache miss — consulta Postgres
    const device = await this.db.findDevice(deviceId);

    if (!device) {
      this.logger.warn(
        `Unknown device '${deviceId}' — auto-registering with status=pending`,
      );
      await this.db.registerPendingDevice(deviceId, this.config.locationId);
    }

    // Armazena no cache independente do status (ativo ou pending)
    await this.redis.cacheDevice(deviceId);
  }
}
