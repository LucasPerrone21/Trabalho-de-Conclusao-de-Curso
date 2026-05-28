import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';

async function bootstrap() {
  const config = loadConfig();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.MQTT,
      options: {
        host: config.mqttBrokerHost,
        port: config.mqttBrokerPort,
        username: config.mqttUsername,
        password: config.mqttPassword,
        clientId: `ingest-service-${config.locationId}`,
        // Subscreve em todos os tópicos da localidade
        subscribeOptions: {
          qos: 1,
        },
        // Reconexão automática em falhas do broker
        reconnectPeriod: 3000,
        connectTimeout: 10000,
      },
    },
  );

  await app.listen();
  console.log(`[ingest-service] listening on MQTT ${config.mqttBrokerHost}:${config.mqttBrokerPort}`);
}

bootstrap().catch((err) => {
  console.error('[ingest-service] Fatal error during bootstrap:', err);
  process.exit(1);
});
