import { Module } from '@nestjs/common';
import { AppConfig, loadConfig } from '../config/env';
import { InfluxService } from '../influx/influx.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PersistenceService } from './persistence.service';

@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => loadConfig(),
    },
    PrismaService,
    RedisService,
    InfluxService,
    PersistenceService,
  ],
})
export class PersistenceModule {}
