import { ValidationPipe } from '@nestjs/common';

import { PaginationQueryDto } from './pagination-query.dto.js';

describe('PaginationQueryDto', () => {
  const validationPipe: ValidationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  async function transform(query: Record<string, unknown>): Promise<PaginationQueryDto> {
    return validationPipe.transform(query, {
      type: 'query',
      metatype: PaginationQueryDto,
      data: '',
    }) as Promise<PaginationQueryDto>;
  }

  it('should convert query strings to numbers', async () => {
    const result: PaginationQueryDto = await transform({
      page: '2',
      limit: '30',
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(30);
  });

  it('should use default values', async () => {
    const result: PaginationQueryDto = await transform({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should reject page lower than 1', async () => {
    await expect(
      transform({
        page: '0',
        limit: '20',
      }),
    ).rejects.toThrow();
  });

  it('should reject limit greater than 100', async () => {
    await expect(
      transform({
        page: '1',
        limit: '101',
      }),
    ).rejects.toThrow();
  });

  it('should reject non-numeric page', async () => {
    await expect(
      transform({
        page: 'abc',
        limit: '20',
      }),
    ).rejects.toThrow();
  });
});