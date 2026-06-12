/**
 * Configuração de ambiente do persistence-service.
 * DATABASE_URL é lido diretamente pelo Prisma Client via variável de ambiente.
 */
export class AppConfig {
  redisUrl: string;
  influxUrl: string;
  influxToken: string;
  influxOrg: string;
  influxBucket: string;
  influxBatchSize: number;
  influxFlushIntervalMs: number;
  streamKey: string;
  consumerGroup: string;
  consumerName: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(): AppConfig {
  // Valida DATABASE_URL na inicialização para falhar cedo se estiver ausente
  requireEnv('DATABASE_URL');

  return Object.assign(new AppConfig(), {
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    influxUrl: process.env.INFLUXDB_URL ?? 'http://localhost:8086',
    influxToken: requireEnv('INFLUXDB_TOKEN'),
    influxOrg: process.env.INFLUXDB_ORG ?? 'tcc-iot',
    influxBucket: process.env.INFLUXDB_BUCKET ?? 'sensor_readings',
    influxBatchSize: parseInt(process.env.INFLUXDB_BATCH_SIZE ?? '50', 10),
    influxFlushIntervalMs: parseInt(
      process.env.INFLUXDB_FLUSH_INTERVAL_MS ?? '5000',
      10,
    ),
    streamKey: 'sensor.data.received',
    consumerGroup: 'persistence-service',
    consumerName: process.env.CONSUMER_NAME ?? 'persistence-worker-1',
  });
}
