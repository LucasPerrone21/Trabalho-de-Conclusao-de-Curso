export class AppConfig {
  locationId: string;
  mqttBrokerHost: string;
  mqttBrokerPort: number;
  mqttUsername: string;
  mqttPassword: string;
  redisUrl: string;
  dedupTtlSeconds: number;
  // DATABASE_URL é lido diretamente pelo Prisma Client via variável de ambiente
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
    locationId: requireEnv('LOCATION_ID'),
    mqttBrokerHost: process.env.MQTT_BROKER_HOST ?? 'localhost',
    mqttBrokerPort: parseInt(process.env.MQTT_BROKER_PORT ?? '1883', 10),
    mqttUsername: requireEnv('MQTT_EDGE_USERNAME'),
    mqttPassword: requireEnv('MQTT_EDGE_PASSWORD'),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    dedupTtlSeconds: parseInt(process.env.DEDUP_TTL_SECONDS ?? '30', 10),
  });
}
