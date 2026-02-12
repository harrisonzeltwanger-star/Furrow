import { Request } from 'express';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: Request['query']): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit as string, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(page: number, limit: number, totalItems: number) {
  return {
    page,
    limit,
    totalPages: Math.ceil(totalItems / limit),
    totalItems,
  };
}
