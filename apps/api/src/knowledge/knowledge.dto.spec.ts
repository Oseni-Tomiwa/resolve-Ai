import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GroundedAnswerDto } from './grounded-answer.dto';
import { SemanticSearchDto } from './semantic-search.dto';

describe('Knowledge request DTO contracts', () => {
  it('accepts the documented grounded-answer payload and rejects unknown properties', async () => {
    // Arrange
    const accepted = plainToInstance(GroundedAnswerDto, { question: 'How do I reset my password?', documentIds: [] });
    const rejected = plainToInstance(GroundedAnswerDto, { question: 'How do I reset my password?', query: 'unexpected' });
    // Act
    const acceptedErrors = await validate(accepted);
    const rejectedErrors = await validate(rejected, { whitelist: true, forbidNonWhitelisted: true });
    // Assert
    expect(acceptedErrors).toHaveLength(0);
    expect(rejectedErrors.flatMap((error) => Object.keys(error.constraints ?? {}))).toContain('whitelistValidation');
  });

  it('accepts the documented semantic-search payload and transforms numeric controls', async () => {
    // Arrange
    const accepted = plainToInstance(SemanticSearchDto, { query: 'How do I reset my password?', limit: '5', minimumScore: '0.65', documentIds: [] });
    const rejected = plainToInstance(SemanticSearchDto, { query: 'How do I reset my password?', limit: '25' });
    // Act
    const acceptedErrors = await validate(accepted);
    const rejectedErrors = await validate(rejected);
    // Assert
    expect(acceptedErrors).toHaveLength(0);
    expect(accepted.limit).toBe(5);
    expect(accepted.minimumScore).toBe(0.65);
    expect(rejectedErrors.length).toBeGreaterThan(0);
  });
});
