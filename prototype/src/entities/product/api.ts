import { apiGet, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { mockProducts, type Product } from './model';

export async function fetchProducts(
  cursor: string | null,
  query: string,
  sort: string,
): Promise<CursorPage<Product>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? mockProducts.filter((product) =>
          `${product.brandName}${product.productName}`.toLowerCase().includes(normalized),
        )
      : mockProducts;
    return mockPage(filtered, cursor);
  }
  const sortMap: Record<string, string> = {
    'AI 추천순': 'AI_RECOMMENDED',
    인기순: 'POPULAR',
    구매순: 'PURCHASED',
  };
  const data = await apiGet<{ products: Product[]; pagination: Pagination }>('/products', {
    query: query.trim() || undefined,
    sort: sortMap[sort],
    cursor: cursor ?? undefined,
  });
  return { items: data.products, pagination: data.pagination };
}
