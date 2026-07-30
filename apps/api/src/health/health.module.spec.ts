jest.mock('ioredis', () => ({ Redis: jest.fn().mockImplementation(() => ({ ping: jest.fn().mockResolvedValue('PONG'), quit: jest.fn().mockResolvedValue('OK') })) }));
import { HealthController } from './health.module';

describe('HealthController', () => {
  it('returns a lightweight liveness response', () => {
    const controller = new HealthController({} as never);
    expect(controller.check()).toEqual({ success: true, message: 'Service is healthy', data: { status: 'ok' } });
  });

  it('reports dependency readiness without exposing connection details', async () => {
    const controller = new HealthController({ $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never);
    const response = { status: jest.fn() };
    await expect(controller.ready(response as never)).resolves.toEqual({ success: true, message: 'Service is ready', data: { status: 'ready', dependencies: { database: 'ok', redis: 'ok' } } });
    expect(response.status).not.toHaveBeenCalled();
  });
});
