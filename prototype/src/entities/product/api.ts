import { apiGet, USE_MOCK_API } from '../../shared/api/client';
import { type CursorPage, mockPage, type Pagination } from '../../shared/api/pagination';
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
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? mockProducts.filter((product) =>
          `${product.brandName}${product.productName}`.toLowerCase().includes(normalized),
        )
      : mockProducts;
    return mockPage(filtered, cursor);
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
    const product = mockProducts.find((item) => item.productId === productId) ?? mockProducts[0];
    return {
      productId: product.productId,
      brandName: product.brandName,
      productName: product.productName,
      description: '마음을 담아 선물하기 좋은 추천 상품이에요.',
      unitPrice: product.price,
      images: product.thumbnailUrl
        ? [{ imageId: 1, imageUrl: product.thumbnailUrl, displayOrder: 1 }]
        : [],
      stockQuantity: 8,
    };
  }
  const data = await apiGet<{ product: ProductDetail }>(`/products/${productId}`);
  return data.product;
}

const mockCategoryNames = ['뷰티', '카페/디저트', '패션', '테크', '생활', '취미', '건강', '기타'];

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return mockCategoryNames.map((name, index) => ({
      categoryId: index + 1,
      name,
      children: [{ categoryId: (index + 1) * 10 + 1, name }],
    }));
  }
  const data = await apiGet<{ categories: ProductCategory[] }>('/products/categories');
  return data.categories;
}
