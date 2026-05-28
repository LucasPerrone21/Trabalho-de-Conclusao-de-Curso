import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: AppConfig) {}

  onModuleInit() {
    this.client = new Redis(this.config.redisUrl, {
      lazyConnect: false,
    });
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Tenta marcar message_id como visto.
   * Retorna true se é NOVO (deve processar), false se é DUPLICATA.
   */
  async markIfNew(messageId: string, ttlSeconds: number): Promise<boolean> {
    const key = `dedup:${messageId}`;
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK'; // OK = foi inserido agora = novo
  }

  /**
   * Cache de devices conhecidos para evitar roundtrips ao Postgres em cada mensagem.
   * TTL de 5 minutos — força revalidação periódica.
   */
  async isDeviceCached(deviceId: string): Promise<boolean> {
    const result = await this.client.get(`device:${deviceId}`);
    return result !== null;
  }

  async cacheDevice(deviceId: string): Promise<void> {
    await this.client.set(`device:${deviceId}`, '1', 'EX', 300); // 5 min
  }

  /**
   * Publica no Redis Stream sensor.data.received.
   * XADD garante ordem e persistência.
   */
  async publishToStream(streamKey: string, fields: Record<string, string>): Promise<string> {
    const args: string[] = [];
    for (const [k, v] of Object.entries(fields)) {
      args.push(k, v);
    }
    const id = await this.client.xadd(streamKey, '*', ...args);
    return id as string;
  }
}
