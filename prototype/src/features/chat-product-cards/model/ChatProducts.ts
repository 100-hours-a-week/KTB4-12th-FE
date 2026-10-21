import { fetchProductDetail, type Product, type ProductDetail } from '../../../entities/product';
import { ApiError } from '../../../shared/api/client';
import { getSessionVersion } from '../../../shared/api/session';

export type CardState =
  | { status: 'loading' }
  | { status: 'ready'; product: ProductDetail; checking: boolean }
  | { status: 'unavailable' | 'error'; message: string };

function validate(product: ProductDetail, id: number) {
  if (
    !product ||
    product.productId !== id ||
    !product.productName?.trim() ||
    typeof product.brandName !== 'string' ||
    !Number.isFinite(product.unitPrice) ||
    product.unitPrice < 0 ||
    !Number.isSafeInteger(product.stockQuantity) ||
    product.stockQuantity < 0 ||
    !Array.isArray(product.images) ||
    product.images.some(
      (image) => typeof image.imageUrl !== 'string' || !Number.isFinite(image.displayOrder),
    )
  )
    throw new Error('Invalid product response');
  return product;
}

export function productImage(product: ProductDetail) {
  return [...product.images].sort((a, b) => a.displayOrder - b.displayOrder)[0]?.imageUrl ?? '';
}

// One cache per chat screen: final Turn replacement reuses completed and in-flight lookups.
export class ChatProducts {
  private states: Record<number, CardState> = {};
  private listeners = new Set<() => void>();
  private requests = new Map<number, AbortController>();
  private version = getSessionVersion();
  private active = false;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.states;
  private set(id: number, state: CardState) {
    this.states = { ...this.states, [id]: state };
    this.listeners.forEach((listener) => listener());
  }
  ensure(ids: number[]) {
    ids.forEach((id) => {
      if (!this.states[id] || (this.states[id].status === 'loading' && !this.requests.has(id)))
        void this.load(id);
    });
  }
  start = () => {
    this.active = true;
    this.version = getSessionVersion();
    return () => {
      this.active = false;
      // StrictMode immediately remounts effects; keep its original in-flight requests.
      queueMicrotask(() => {
        if (this.active) return;
        this.requests.forEach((controller) => controller.abort());
        this.requests.clear();
      });
    };
  };
  async load(id: number, open = false): Promise<Product | null> {
    if (this.requests.has(id)) return null;
    // The AI guide reserves these IDs for mock cards; never query or purchase them.
    if (id >= 900000001 && id <= 900000003) {
      this.set(id, {
        status: 'unavailable',
        message: '테스트용 추천 상품입니다. 실제 상품 보기에는 사용할 수 없어요.',
      });
      return null;
    }
    const controller = new AbortController();
    this.requests.set(id, controller);
    const old = this.states[id];
    this.set(id, old?.status === 'ready' ? { ...old, checking: true } : { status: 'loading' });
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const product = validate(await fetchProductDetail(id, controller.signal), id);
      if (
        !this.active ||
        this.requests.get(id) !== controller ||
        this.version !== getSessionVersion()
      )
        return null;
      this.set(id, { status: 'ready', product, checking: false });
      if (!open || product.stockQuantity === 0) return null;
      return {
        productId: id,
        brandName: product.brandName,
        productName: product.productName,
        price: product.unitPrice,
        thumbnailUrl: productImage(product),
      };
    } catch (error) {
      if (
        !this.active ||
        this.requests.get(id) !== controller ||
        this.version !== getSessionVersion()
      )
        return null;
      const unavailable = error instanceof ApiError && [403, 404, 410].includes(error.status);
      this.set(id, {
        status: unavailable ? 'unavailable' : 'error',
        message: unavailable
          ? '삭제되었거나 접근할 수 없는 상품입니다.'
          : '상품 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
      });
      return null;
    } finally {
      clearTimeout(timer);
      if (this.requests.get(id) === controller) this.requests.delete(id);
    }
  }
}
