import { ApiError, apiGet, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
import { isQaScenario, shouldFailUntilRecovery } from '../../shared/config/qaScenario';
import { categoryTree } from '../category';
import {
  mockProducts,
  type Product,
  type ProductCategory,
  type ProductDetail,
  type ProductSort,
} from './model';

export async function fetchProducts(
  cursor: string | null,
  query: string,
  sort: ProductSort,
  categoryIds: number[] = [],
): Promise<CursorPage<Product>> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    if (shouldFailUntilRecovery('product-list-error')) {
      throw new ApiError('상품을 불러오지 못했습니다. 다시 시도해 주세요.', 500, {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? mockProducts.filter((product) =>
          `${product.brandName}${product.productName}`.toLowerCase().includes(normalized),
        )
      : mockProducts;
    const products = isQaScenario('product-no-image')
      ? filtered.map((product, index) => (index === 0 ? { ...product, thumbnailUrl: '' } : product))
      : filtered;
    return mockPage(products, cursor);
  }
  const data = await apiGet<{
    products: Product[];
    pagination: Pagination;
    appliedSort: ProductSort;
  }>('/products', {
    query: query.trim() || undefined,
    sort,
    categoryIds: categoryIds.length ? categoryIds.join(',') : undefined,
    cursor: cursor ?? undefined,
  });
  return { items: data.products, pagination: data.pagination };
}

export async function fetchProductDetail(productId: number): Promise<ProductDetail> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    if (isQaScenario('product-detail-error')) {
      throw new ApiError('상품 정보를 불러오지 못했습니다.', 500, {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    const product = mockProducts.find((item) => item.productId === productId) ?? mockProducts[0];
    return {
      productId: product.productId,
      brandName: product.brandName,
      productName: product.productName,
      description: '마음을 담아 선물하기 좋은 추천 상품이에요.',
      unitPrice: product.price,
      images: isQaScenario('product-no-image')
        ? []
        : product.thumbnailUrl
          ? [{ imageId: 1, imageUrl: product.thumbnailUrl, displayOrder: 1 }]
          : [],
      stockQuantity: isQaScenario('product-sold-out') ? 0 : 8,
    };
  }
  const data = await apiGet<{ product: ProductDetail }>(`/products/${productId}`);
  return data.product;
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return categoryTree;
  }
  const data = await apiGet<{ categories: ProductCategory[] }>('/products/categories');
  return data.categories;
}
