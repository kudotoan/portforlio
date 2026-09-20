import type { PaginationMeta } from '../types/pagination.type.js';

export function calculatePaginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function calculateTotalPages(totalItems: number, limit: number): number {
  return Math.ceil(totalItems / limit);
}

export function createPaginationMeta(page: number, limit: number, totalItems: number): PaginationMeta {
  return {
    page: page,
    limit: limit,
    totalItems: totalItems,
    totalPages: calculateTotalPages(totalItems, limit),
  };
}