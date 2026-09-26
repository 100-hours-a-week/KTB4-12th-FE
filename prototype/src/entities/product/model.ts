import { PRODUCT_IMAGE } from '../../shared/config/assets';

export { PRODUCT_IMAGE } from '../../shared/config/assets';

export type Product = {
  productId: number;
  brandName: string;
  productName: string;
  price: number;
  thumbnailUrl: string;
};

export type ProductSort = 'AI_RECOMMENDED' | 'POPULAR' | 'MOST_GIFTED' | 'NEWEST';

export type ProductDetail = {
  productId: number;
  brandName: string;
  productName: string;
  description: string | null;
  unitPrice: number;
  images: Array<{ imageId: number; imageUrl: string; displayOrder: number }>;
  stockQuantity: number;
};

export type ProductCategory = {
  categoryId: number;
  name: string;
  children: Array<{ categoryId: number; name: string }>;
};

export const mockProducts: Product[] = Array.from({ length: 44 }, (_, index) => ({
  productId: index + 101,
  brandName: index % 3 === 0 ? '이니스프리' : index % 3 === 1 ? '오설록' : '선잘알 셀렉트',
  productName:
    index % 3 === 0
      ? '그린티 수분 크림'
      : index % 3 === 1
        ? '프리미엄 티 세트'
        : '포근한 데일리 선물 세트',
  price: 24000 + (index % 5) * 4000,
  thumbnailUrl: PRODUCT_IMAGE,
}));
