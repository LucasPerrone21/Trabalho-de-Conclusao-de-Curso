import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppConfig } from '../config/env';
import { InfluxService } from '../influx/influx.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SensorDataEvent } from './persistence.types';

@Injectable()
export class PersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PersistenceService.name);

  /** Controla o loop de consumo */
  private running = false;

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    private readonly influx: InfluxService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Garante que o consumer group existe antes de começar a consumir
    await this.redis.ensureConsumerGroup();

    this.running = true;
    this.logger.log(
      `Starting consumer loop | stream=${this.config.streamKey} group=${this.config.consumerGroup} consumer=${this.config.consumerName}`,
    );

    // Inicia o loop em background — não bloqueia o bootstrap
    void this.consumeLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.logger.log('Stopping consumer loop...');

    // Força flush do buffer InfluxDB antes de encerrar
    await this.influx.flush().catch((err) =>
      this.logger.error('Error during final InfluxDB flush', err),
    );
  }

  /**
   * Loop principal de consumo do Redis Stream.
   *
   * Estratégia: write-before-ack (Opção B do plano)
   *   1. Lê batch do stream
   *   2. Para cada mensagem: escreve no InfluxDB (buffered) → XACK
   *   3. Atualiza last_seen_at no Postgres (fire-and-forget)
   *
   * Se o write no InfluxDB falhar, a mensagem NÃO é ACKed e será reentregue
   * no próximo ciclo. Duplicatas são aceitáveis em série temporal (mesmo
   * timestamp + device + metric sobrescreve no InfluxDB).
   */
  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const entries = await this.redis.readBatch(10, 5000);

        if (entries.length === 0) {
          // Timeout do BLOCK — nenhuma mensagem, continua esperando
          continue;
        }

        this.logger.debug(`Received ${entries.length} entries from stream`);

        for (const entry of entries) {
          await this.processEntry(entry.id, entry.fields);
        }
      } catch (err) {
        this.logger.error('Error in consume loop', err);
        // Backoff simples: aguarda 1s antes de tentar novamente
        await this.sleep(1000);
      }
    }
  }

  /**
   * Processa uma entrada individual do stream.
   */
  private async processEntry(
    id: string,
    fields: Record<string, string>,
  ): Promise<void> {
    // 1. Parse do JSON armazenado no campo "data"
    let event: SensorDataEvent;
    try {
      event = JSON.parse(fields.data) as SensorDataEvent;
    } catch {
      this.logger.warn(`Malformed JSON in stream entry ${id} — skipping`);
      // ACK mesmo assim para não re-processar lixo indefinidamente
      await this.redis.ack(id);
      return;
    }

    if (!event?.payload?.device_id || event?.payload?.value === undefined) {
      this.logger.warn(`Missing required fields in event ${id} — skipping`);
      await this.redis.ack(id);
      return;
    }

    // 2. Escreve no InfluxDB (buffered — flush automático pelo SDK)
    //    Erro aqui lança exceção → não chega no XACK → mensagem reprocessada
    try {
      this.influx.writePoint(event);
    } catch (err) {
      this.logger.error(
        `Failed to write point for event ${id} — will retry`,
        err,
      );
      // Não faz ACK: a mensagem ficará como "pending" e será reentregue
      return;
    }

    // 3. XACK após write bem-sucedido (at-least-once)
    await this.redis.ack(id);

    this.logger.debug(
      `ACKed | id=${id} device=${event.payload.device_id} metric=${event.payload.metric}`,
    );

    // 4. Atualiza last_seen_at no Postgres (fire-and-forget — não bloqueia pipeline)
    void this.prisma.device
      .updateMany({
        where: { id: event.payload.device_id },
        data: { lastSeenAt: new Date() },
      })
      .catch((err) =>
        this.logger.error(
          `Failed to touch device ${event.payload.device_id}`,
          err,
        ),
      );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
