import { Module } from '@nestjs/common';
import { IngestModule } from './ingest/ingest.module';

@Module({
  imports: [IngestModule],
})
export class AppModule {}
