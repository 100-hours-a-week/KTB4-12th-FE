import { apiGet, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { mockReceivedGifts, type ReceivedGift } from './model';

export async function fetchReceivedGifts(cursor: string | null): Promise<CursorPage<ReceivedGift>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockPage(mockReceivedGifts, cursor);
  }
  const data = await apiGet<{ items: ReceivedGift[]; pagination: Pagination }>('/gifts/received', {
    cursor: cursor ?? undefined,
  });
  return { items: data.items, pagination: data.pagination };
}
