import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ConditionAssessmentService } from '../src/ai/condition-assessment.service';
import { Item, ItemCondition } from '../src/items/entities/item.entity';

const configFor = (values: Record<string, string>): ConfigService =>
  ({ get: jest.fn((key: string) => values[key]) } as unknown as ConfigService);

const noopRepo = () =>
  ({
    findOne: jest.fn(),
    save: jest.fn(),
  }) as unknown as jest.Mocked<Pick<Repository<Item>, 'findOne' | 'save'>>;

describe('ConditionAssessmentService', () => {
  describe('normalize', () => {
    const service = new ConditionAssessmentService(
      configFor({ OPENAI_LOCAL_MODE: 'true' }),
      noopRepo() as unknown as Repository<Item>,
    );

    it('maps a well-formed model payload to a clamped result', () => {
      const result = service.normalize(
        { condition: 'Good', confidence: 0.82, notes: 'Minor scuffs on the corners.' },
        Date.now(),
      );

      expect(result.condition).toBe('good');
      expect(result.confidence).toBe(0.82);
      expect(result.notes).toBe('Minor scuffs on the corners.');
      expect(result.fallbackSuggested).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('clamps out-of-range confidence into 0..1', () => {
      expect(service.normalize({ condition: 'poor', confidence: 5 }, Date.now()).confidence).toBe(1);
      expect(service.normalize({ condition: 'poor', confidence: -2 }, Date.now()).confidence).toBe(0);
    });

    it('falls back to fair with confidence 0 on an unknown grade', () => {
      const result = service.normalize(
        { condition: 'mint', confidence: 0.9, notes: 'n/a' },
        Date.now(),
      );

      expect(result.condition).toBe('fair');
      expect(result.confidence).toBe(0);
      expect(result.fallbackSuggested).toBe(true);
    });

    it('handles missing/empty fields without throwing', () => {
      const result = service.normalize({}, Date.now());
      expect(result.condition).toBe('fair');
      expect(result.notes).toBe('');
      expect(result.fallbackSuggested).toBe(true);
    });
  });

  describe('toItemCondition', () => {
    it('maps excellent to like_new and the rest one-to-one', () => {
      expect(ConditionAssessmentService.toItemCondition('excellent')).toBe(ItemCondition.LIKE_NEW);
      expect(ConditionAssessmentService.toItemCondition('good')).toBe(ItemCondition.GOOD);
      expect(ConditionAssessmentService.toItemCondition('fair')).toBe(ItemCondition.FAIR);
      expect(ConditionAssessmentService.toItemCondition('poor')).toBe(ItemCondition.POOR);
    });
  });

  describe('assess', () => {
    it('requires a photoUrl or imageBase64', async () => {
      const service = new ConditionAssessmentService(
        configFor({ OPENAI_LOCAL_MODE: 'true' }),
        noopRepo() as unknown as Repository<Item>,
      );

      await expect(service.assess({})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns the local mock when the model is not configured', async () => {
      const service = new ConditionAssessmentService(
        configFor({ OPENAI_LOCAL_MODE: 'true' }),
        noopRepo() as unknown as Repository<Item>,
      );

      const result = await service.assess({ photoUrl: 'https://example.com/p.jpg' });

      expect(result.fallbackSuggested).toBe(true);
      expect(result.confidence).toBe(0);
      expect(['excellent', 'good', 'fair', 'poor']).toContain(result.condition);
    });

    it('parses the live model response and persists onto the item', async () => {
      const repo = noopRepo();
      const item = { id: 'item-1', condition: ItemCondition.GOOD } as Item;
      repo.findOne.mockResolvedValue(item);

      const service = new ConditionAssessmentService(
        configFor({ OPENAI_API_KEY: 'test-key', OPENAI_LOCAL_MODE: 'false' }),
        repo as unknown as Repository<Item>,
      );
      (service as unknown as { openai: unknown }).openai = {
        responses: {
          create: jest.fn().mockResolvedValue({
            output_text: JSON.stringify({
              condition: 'poor',
              confidence: 0.74,
              notes: 'Cracked screen and deep scratches.',
            }),
          }),
        },
      };

      const result = await service.assess({
        itemId: 'item-1',
        photoUrl: 'https://example.com/p.jpg',
      });

      expect(result.condition).toBe('poor');
      expect(result.confidence).toBe(0.74);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(item.condition).toBe(ItemCondition.POOR);
      expect(repo.save).toHaveBeenCalledWith(item);
    });

    it('still returns the assessment when the itemId does not exist', async () => {
      const repo = noopRepo();
      repo.findOne.mockResolvedValue(null);

      const service = new ConditionAssessmentService(
        configFor({ OPENAI_API_KEY: 'test-key', OPENAI_LOCAL_MODE: 'false' }),
        repo as unknown as Repository<Item>,
      );
      (service as unknown as { openai: unknown }).openai = {
        responses: {
          create: jest.fn().mockResolvedValue({
            output_text: JSON.stringify({ condition: 'excellent', confidence: 0.99, notes: 'Pristine.' }),
          }),
        },
      };

      const result = await service.assess({
        itemId: 'missing',
        photoUrl: 'https://example.com/p.jpg',
      });

      expect(result.condition).toBe('excellent');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
