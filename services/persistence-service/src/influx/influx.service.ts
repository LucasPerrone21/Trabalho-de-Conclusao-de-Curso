import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import { AppConfig } from '../config/env';
import { SensorDataEvent } from '../persistence/persistence.types';

@Injectable()
export class InfluxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfluxService.name);
  private writeApi: WriteApi;

  constructor(private readonly config: AppConfig) {}

  onModuleInit() {
    const client = new InfluxDB({
      url: this.config.influxUrl,
      token: this.config.influxToken,
    });

    this.writeApi = client.getWriteApi(
      this.config.influxOrg,
      this.config.influxBucket,
      'ms', // precisão de timestamp em milissegundos
      {
        batchSize: this.config.influxBatchSize,
        flushInterval: this.config.influxFlushIntervalMs,
        // Retry automático em falhas transitórias de rede
        maxRetries: 3,
        retryJitter: 200,
      },
    );

    this.logger.log(
      `InfluxDB WriteApi initialized | url=${this.config.influxUrl} org=${this.config.influxOrg} bucket=${this.config.influxBucket}`,
    );
  }

  async onModuleDestroy() {
    try {
      // Garante que o buffer é vaziado antes de encerrar
      await this.writeApi.close();
      this.logger.log('InfluxDB WriteApi closed (buffer flushed)');
    } catch (err) {
      this.logger.error('Error closing InfluxDB WriteApi', err);
    }
  }

  /**
   * Adiciona um ponto de leitura de sensor ao buffer do WriteApi.
   *
   * Measurement : sensor_readings
   * Tags        : device_id, metric, location_id
   * Fields      : value (float)
   * Timestamp   : collected_at do evento (ms epoch)
   *
   * O flush é gerenciado automaticamente pelo SDK via batchSize / flushInterval.
   */
  writePoint(event: SensorDataEvent): void {
    const { payload } = event;

    const point = new Point('sensor_readings')
      .tag('device_id', payload.device_id)
      .tag('metric', payload.metric)
      .tag('location_id', event.location_id)
      .floatField('value', payload.value)
      .timestamp(new Date(payload.collected_at));

    this.writeApi.writePoint(point);

    this.logger.debug(
      `Buffered point | device=${payload.device_id} metric=${payload.metric} value=${payload.value}`,
    );
  }

  /**
   * Força o flush imediato do buffer.
   * Usado pelo PersistenceService no shutdown graceful.
   */
  async flush(): Promise<void> {
    try {
      await this.writeApi.flush();
      this.logger.log('InfluxDB buffer flushed');
    } catch (err) {
      this.logger.error('Error flushing InfluxDB buffer', err);
      throw err;
    }
  }
}
