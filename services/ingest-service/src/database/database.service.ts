import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica se um device existe no Postgres.
   * Retorna o status do device ou null se não existe.
   */
  async findDevice(deviceId: string): Promise<{ status: string } | null> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { status: true },
    });
    return device;
  }

  /**
   * Registra um device desconhecido com status 'pending' e alias temporário.
   * Usa skipDuplicates / ON CONFLICT — safe em race conditions.
   */
  async registerPendingDevice(
    deviceId: string,
    locationSlug: string,
    type: 'sensor' | 'actuator' = 'sensor',
  ): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { slug: locationSlug },
      select: { id: true },
    });

    if (!location) {
      this.logger.warn(
        `Location '${locationSlug}' not found — cannot register device '${deviceId}'`,
      );
      return;
    }

    await this.prisma.device.upsert({
      where: { id: deviceId },
      // Se não existe: cria com pending e alias = deviceId (temporário)
      create: {
        id: deviceId,
        alias: deviceId,
        locationId: location.id,
        type,
        status: 'pending',
        metadata: { auto_registered: true },
      },
      // Se já existe (race condition): não sobrescreve nada importante
      update: {},
    });

    this.logger.warn(
      `Auto-registered device '${deviceId}' with status=pending (location=${locationSlug})`,
    );
  }

  /**
   * Atualiza last_seen_at do device (fire-and-forget, não bloqueia o fluxo).
   */
  async touchDevice(deviceId: string): Promise<void> {
    // updateMany não lança P2025 se o device não existir (race condition no auto-registro)
    await this.prisma.device.updateMany({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }
}
