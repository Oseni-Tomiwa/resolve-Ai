import { UnauthorizedException } from '@nestjs/common';
jest.mock('argon2', () => ({ __esModule: true, hash: jest.fn(), verify: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ __esModule: true, sign: jest.fn() }));
// Load the service after registering factories for its native and token dependencies.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthService } = require('./auth.service') as typeof import('./auth.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedArgon2 = require('argon2') as { hash: jest.Mock; verify: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedJwt = require('jsonwebtoken') as { sign: jest.Mock };

type MockDatabase = {
  user: { findUnique: jest.Mock; create: jest.Mock };
  refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

const createDatabase = (): MockDatabase => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
});

const user = {
  id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', passwordHash: 'hashed-password',
  emailVerifiedAt: null, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(mockedArgon2, 'hash').mockResolvedValue('hashed-password');
    jest.spyOn(mockedArgon2, 'verify').mockResolvedValue(true);
    jest.spyOn(mockedJwt, 'sign').mockReturnValue('access-token' as never);
  });

  it('registers a normalized user and persists a hashed refresh token', async () => {
    // Arrange
    const db = createDatabase();
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(user);
    const service = new AuthService(db as never);

    // Act
    const result = await service.register({ firstName: ' Ada ', lastName: ' Lovelace ', email: ' ADA@EXAMPLE.COM ', password: 'Password123!' });

    // Assert
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'hashed-password' }) }));
    expect(db.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', tokenHash: expect.any(String) }) }));
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('logs in with a valid password and returns a public user', async () => {
    // Arrange
    const db = createDatabase();
    db.user.findUnique.mockResolvedValue(user);
    const service = new AuthService(db as never);

    // Act
    const result = await service.login({ email: 'ADA@EXAMPLE.COM', password: 'Password123!' });

    // Assert
    expect(mockedArgon2.verify).toHaveBeenCalledWith('hashed-password', 'Password123!');
    expect(result.user).toMatchObject({ id: 'user-1', email: 'ada@example.com' });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an invalid password without revealing account details', async () => {
    // Arrange
    const db = createDatabase();
    db.user.findUnique.mockResolvedValue(user);
    mockedArgon2.verify.mockResolvedValue(false);
    const service = new AuthService(db as never);

    // Act
    const action = service.login({ email: 'ada@example.com', password: 'wrong-password' });

    // Assert
    await expect(action).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and revokes the previous token', async () => {
    // Arrange
    const db = createDatabase();
    db.refreshToken.findUnique.mockResolvedValue({ id: 'refresh-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    db.refreshToken.update.mockResolvedValue({});
    db.refreshToken.create.mockResolvedValue({});
    db.$transaction.mockResolvedValue([]);
    const service = new AuthService(db as never);

    // Act
    const result = await service.refresh('old-refresh-token');

    // Assert
    expect(result.refreshToken).not.toBe('old-refresh-token');
    expect(db.refreshToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'refresh-1' }, data: { revokedAt: expect.any(Date) } }));
    expect(db.$transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.anything(), expect.anything()]));
  });
});
