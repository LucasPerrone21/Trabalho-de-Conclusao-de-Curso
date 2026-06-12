import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/env';

async function bootstrap() {
  // Valida envs na inicialização — falha rápido se algo estiver faltando
  loadConfig();

  const app = await NestFactory.create(AppModule, {
    // Sem HTTP server — serviço pure consumer
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // Shutdown graceful: aguarda até 10s para drenas mensagens em processamento
  app.enableShutdownHooks();

  // Inicia o contexto sem levantar HTTP server
  await app.init();

  console.log('[persistence-service] Consumer loop started');
}

bootstrap().catch((err) => {
  console.error('[persistence-service] Fatal error during bootstrap:', err);
  process.exit(1);
});
