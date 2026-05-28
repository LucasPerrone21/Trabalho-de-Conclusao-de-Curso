import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, MqttContext, Payload } from '@nestjs/microservices';
import { IngestService } from './ingest.service';

@Controller()
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(private readonly ingestService: IngestService) {}

  /**
   * Subscreve em {LOCATION_ID}/# via MQTT.
   * O '#' é um wildcard MQTT que captura todos os sub-tópicos.
   *
   * Formato do tópico esperado: {location_id}/{device_id}/{metric}
   * Exemplo: ufba/esp32-a4f3/temperature
   */
  @MessagePattern('+/+/+')
  async handleSensorReading(
    @Payload() payload: Buffer | object,
    @Ctx() context: MqttContext,
  ): Promise<void> {
    const topic = context.getTopic();
    try {
      await this.ingestService.handleMessage(topic, payload);
    } catch (err) {
      this.logger.error(`Unhandled error on topic ${topic}`, err);
    }
  }
}
