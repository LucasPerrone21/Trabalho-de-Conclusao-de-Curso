import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/env';

/**
 * Uma entrada lida do Redis Stream.
 */
export interface StreamEntry {
  /** ID gerado pelo Redis (ex: "1718123456789-0") */
  id: string;
  /** Campos da mensagem; "data" contém o JSON do SensorDataEvent */
  fields: Record<string, string>;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: AppConfig) {}

  onModuleInit() {
    this.client = new Redis(this.config.redisUrl, { lazyConnect: false });
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Cria o consumer group no stream (idempotente).
   * MKSTREAM garante que o stream é criado se não existir.
   * '$' significa "somente novas mensagens a partir de agora".
   * '0' significa "processar desde o início" — útil para replay em dev.
   */
  async ensureConsumerGroup(): Promise<void> {
    try {
      await this.client.xgroup(
        'CREATE',
        this.config.streamKey,
        this.config.consumerGroup,
        '0', // lê desde o início do stream
        'MKSTREAM',
      );
      this.logger.log(
        `Consumer group '${this.config.consumerGroup}' created on stream '${this.config.streamKey}'`,
      );
    } catch (err: any) {
      // BUSYGROUP = grupo já existe; não é erro
      if (err?.message?.includes('BUSYGROUP')) {
        this.logger.log(
          `Consumer group '${this.config.consumerGroup}' already exists`,
        );
      } else {
        throw err;
      }
    }
  }

  /**
   * Lê um batch de mensagens pendentes do consumer group.
   *
   * @param count   Número máximo de mensagens por chamada
   * @param blockMs Tempo de bloqueio se não houver mensagens (0 = não bloqueia)
   * @returns Array de entradas ou array vazio se timeout
   */
  async readBatch(count = 10, blockMs = 5000): Promise<StreamEntry[]> {
    // XREADGROUP GROUP <group> <consumer> COUNT <n> BLOCK <ms> STREAMS <key> >
    // '>' significa "mensagens ainda não entregues a nenhum consumer"
    const result = await this.client.xreadgroup(
      'GROUP',
      this.config.consumerGroup,
      this.config.consumerName,
      'COUNT',
      count,
      'BLOCK',
      blockMs,
      'STREAMS',
      this.config.streamKey,
      '>',
    );

    if (!result) {
      // Timeout do BLOCK — nenhuma mensagem nova
      return [];
    }

    // result: [[streamKey, [[id, [k1,v1,k2,v2,...]], ...]]]
    const [, entries] = result[0] as [string, [string, string[]][]];
    return entries.map(([id, rawFields]) => ({
      id,
      fields: this.parseFields(rawFields),
    }));
  }

  /**
   * Confirma o processamento de uma mensagem (XACK).
   * Chamado APÓS a persistência com sucesso — garante at-least-once.
   */
  async ack(id: string): Promise<void> {
    await this.client.xack(
      this.config.streamKey,
      this.config.consumerGroup,
      id,
    );
  }

  /**
   * Converte array linear [k1, v1, k2, v2, ...] em objeto { k1: v1, k2: v2 }.
   */
  private parseFields(raw: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    for (let i = 0; i < raw.length; i += 2) {
      fields[raw[i]] = raw[i + 1];
    }
    return fields;
  }
}
