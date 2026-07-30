import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { RateLimitService } from '../common/rate-limit.service';

describe('AuthController', () => {
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  const auth = { login: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, tokens: { accessToken: 'access', refreshToken: 'refresh' } }) };
  const rateLimit = { allow: jest.fn().mockReturnValue(true) };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.COOKIE_DOMAIN;
    process.env.COOKIE_SECURE = 'false';
    process.env.COOKIE_SAME_SITE = 'lax';
    controller = new AuthController(auth as unknown as AuthService, rateLimit as unknown as RateLimitService);
  });

  it('sets development cookies for the registered login route', async () => {
    // Arrange / Act
    await controller.login({ email: 'user@example.com', password: 'Password123!' }, { ip: '127.0.0.1', headers: {} }, response);

    // Assert
    expect(response.cookie).toHaveBeenCalledWith('resolveai_access_token', 'access', expect.objectContaining({ secure: false, sameSite: 'lax', path: '/', httpOnly: true }));
    expect(response.cookie).toHaveBeenCalledWith('resolveai_refresh_token', 'refresh', expect.objectContaining({ secure: false, sameSite: 'lax', path: '/', httpOnly: true }));
    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it('uses secure cookies and omits a localhost domain in production', async () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAME_SITE = 'none';
    process.env.COOKIE_DOMAIN = '';

    // Act
    await controller.login({ email: 'user@example.com', password: 'Password123!' }, { ip: '127.0.0.1', headers: {} }, response);

    // Assert
    expect(response.cookie).toHaveBeenCalledWith('resolveai_access_token', 'access', expect.objectContaining({ secure: true, sameSite: 'none', path: '/', httpOnly: true }));
    expect(response.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
  });
});
