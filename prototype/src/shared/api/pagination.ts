export type Pagination = { nextCursor: string | null; hasNext: boolean };
export type CursorPage<T> = { items: T[]; pagination: Pagination };

const MOCK_PAGE_SIZE = 20;

export function mockPage<T>(items: T[], cursor?: string | null): CursorPage<T> {
  const start = cursor?.startsWith('mock:') ? Number(cursor.slice(5)) : 0;
  const nextStart = start + MOCK_PAGE_SIZE;
  return {
    items: items.slice(start, nextStart),
    pagination: {
      nextCursor: nextStart < items.length ? `mock:${nextStart}` : null,
      hasNext: nextStart < items.length,
    },
  };
}
