import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnalyticsQueryDto } from './analytics.dto';

describe('AnalyticsQueryDto', () => {
  it('rejects the legacy day query field while accepting days', async () => {
    // Arrange
    const legacy = plainToInstance(AnalyticsQueryDto, { day: 30 });
    const current = plainToInstance(AnalyticsQueryDto, { days: 30 });

    // Act
    const legacyErrors = await validate(legacy, { whitelist: true, forbidNonWhitelisted: true });
    const currentErrors = await validate(current, { whitelist: true, forbidNonWhitelisted: true });

    // Assert
    expect(legacyErrors.flatMap((error) => Object.keys(error.constraints ?? {}))).toContain('whitelistValidation');
    expect(currentErrors).toHaveLength(0);
  });

  it('rejects ranges outside the supported analytics window', async () => {
    // Arrange
    const query = plainToInstance(AnalyticsQueryDto, { days: 6 });

    // Act
    const errors = await validate(query, { whitelist: true, forbidNonWhitelisted: true });

    // Assert
    expect(errors.flatMap((error) => Object.keys(error.constraints ?? {}))).toContain('min');
  });
});
