import { calculatePaginationSkip, calculateTotalPages, createPaginationMeta } from './pagination.util.js';

describe('PaginationUtil', () => {
  describe('calculatePaginationSkip', () => {
    it('should return 0 for the first page', () => {
      const result: number = calculatePaginationSkip(1, 20);

      expect(result).toBe(0);
    });

    it('should calculate skip correctly', () => {
      const result: number = calculatePaginationSkip(3, 20);

      expect(result).toBe(40);
    });
  });

  describe('calculateTotalPages', () => {
    it('should calculate total pages correctly', () => {
      const result: number = calculateTotalPages(135, 20);

      expect(result).toBe(7);
    });

    it('should return 0 when there are no items', () => {
      const result: number = calculateTotalPages(0, 20);

      expect(result).toBe(0);
    });
  });

  describe('createPaginationMeta', () => {
    it('should create pagination metadata correctly', () => {
      const result = createPaginationMeta(3, 20, 135);

      expect(result).toEqual({
        page: 3,
        limit: 20,
        totalItems: 135,
        totalPages: 7,
      });
    });
  });
});