import { Module } from '@nestjs/common';
import { AppConfig, loadConfig } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  controllers: [IngestController],
  providers: [
    {
      provide: AppConfig,
      useFactory: () => loadConfig(),
    },
    PrismaService,
    RedisService,
    DatabaseService,
    IngestService,
  ],
})
export class IngestModule {}
