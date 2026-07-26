import { Controller, Get, Module } from '@nestjs/common';
@Controller('health')
class HealthController { @Get() check(): { success: true; message: string; data: { status: string } } { return { success: true, message: 'Service is healthy', data: { status: 'ok' } }; } }
@Module({ controllers: [HealthController] }) export class HealthModule {}
