import {
  BoxIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MixerHorizontalIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import { useCallback, useEffect, useRef, useState } from 'react';

import { preflightGift, sendGift, type SentGiftResult } from '../../../entities/gift';
import {
  fetchProductDetail,
  fetchProducts,
  type Product,
  PRODUCT_IMAGE,
} from '../../../entities/product';
import type { SearchedUser } from '../../../entities/user';
import { KeyboardInput } from '../../../mobile';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor, ScreenHeader, SettingRow } from '../../../shared/ui';

// crypto.randomUUID 미지원 환경(구형 브라우저 등)에서도 백엔드가 요구하는 UUID 형식을 지키기 위한 폴백.
function generateUuidFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function GiftsPage({
  filterCount,
  filterCategoryIds,
  onFilter,
  onProduct,
}: {
  filterCount: number;
  filterCategoryIds: number[];
  onFilter: () => void;
  onProduct: (product: Product) => void;
}) {
  const [sort, setSort] = useState('인기순');
  const [search, setSearch] = useState('');
  const loader = useCallback(
    (cursor: string | null) => fetchProducts(cursor, search, sort, filterCategoryIds),
    [search, sort, filterCategoryIds],
  );
  const list = useCursorList(loader, `${search}:${sort}:${filterCategoryIds.join(',')}`);

  return (
    <section className="page gifts-page">
      <ScreenHeader title="선물 탐색" />
      <div className="gift-search-row">
        <div className="inline-search">
          <MagnifyingGlassIcon />
          <KeyboardInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="상품명을 입력해 주세요."
          />
        </div>
        <button
          type="button"
          className="filter-button"
          aria-label={filterCount ? `필터, ${filterCount}개 선택됨` : '필터'}
          onClick={onFilter}
        >
          <MixerHorizontalIcon /> 필터{filterCount ? <b>{filterCount}</b> : null}
        </button>
      </div>
      <div className="sort-row" role="radiogroup" aria-label="상품 정렬">
        <span>정렬</span>
        {['인기순', 'AI 추천순', '구매순'].map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={sort === option}
            key={option}
            onClick={() => setSort(option)}
          >
            <span className={sort === option ? 'radio active' : 'radio'} />
            {option}
          </button>
        ))}
      </div>
      <div className="product-grid">
        {list.items.map((product) => (
          <button
            type="button"
            className="product-card"
            onClick={() => onProduct(product)}
            key={product.productId}
          >
            <img
              src={product.thumbnailUrl || PRODUCT_IMAGE}
              alt={product.productName}
              draggable={false}
            />
            <span>{product.brandName}</span>
            <strong>{product.productName}</strong>
            <small>{product.price.toLocaleString()}원</small>
          </button>
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel="일치하는 상품이 없어요"
        onLoadMore={list.loadMore}
        onRetry={list.retry}
      />
    </section>
  );
}

type ProductPageProps = {
  product: Product;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onBack: () => void;
  onGift: () => void;
};

export function ProductPage({
  product,
  quantity,
  onDecrease,
  onIncrease,
  onBack,
  onGift,
}: ProductPageProps) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchProductDetail>> | null>(null);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProductDetail(product.productId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((reason) => {
        if (!cancelled)
          setDetailError(
            reason instanceof Error ? reason.message : '상품 정보를 불러오지 못했습니다.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [product.productId]);

  const price = detail?.unitPrice ?? product.price;
  const soldOut = detail !== null && detail.stockQuantity <= 0;
  const heroImage = detail?.images[0]?.imageUrl || product.thumbnailUrl || PRODUCT_IMAGE;

  return (
    <section className="page product-detail">
      <ScreenHeader title="상품 상세" onBack={onBack} />
      <img
        className="product-hero"
        src={heroImage}
        alt={`${product.brandName} ${product.productName}`}
        draggable={false}
      />
      <article className="detail-card">
        <small>{product.brandName}</small>
        <strong>{product.productName}</strong>
      </article>
      <article className="detail-card">
        <small>상품 설명</small>
        <p>{detail?.description ?? '상품 정보를 불러오는 중이에요.'}</p>
      </article>
      <SettingRow label="상품 금액" value={`${price.toLocaleString()}원`} />
      {soldOut ? <p className="field-error">품절된 상품이에요</p> : null}
      {detailError ? <p className="field-error">{detailError}</p> : null}
      <div className="quantity-row">
        <span>수량</span>
        <div>
          <button type="button" aria-label="수량 줄이기" onClick={onDecrease}>
            <MinusIcon />
          </button>
          <strong>{quantity}</strong>
          <button type="button" aria-label="수량 늘리기" onClick={onIncrease}>
            <PlusIcon />
          </button>
        </div>
      </div>
      <button type="button" className="primary product-cta" disabled={soldOut} onClick={onGift}>
        <BoxIcon /> 선물하기 <span>{(price * quantity).toLocaleString()}원</span>
      </button>
    </section>
  );
}

type CompletePageProps = {
  product: Product;
  quantity: number;
  recipient: SearchedUser | null;
  onFriends: () => void;
};

type CompleteState =
  | { status: 'sending' }
  | {
      status: 'done';
      result: SentGiftResult;
      warning: { categoryId: number; categoryName: string } | null;
    }
  | { status: 'error'; message: string };

export function CompletePage({ product, quantity, recipient, onFriends }: CompletePageProps) {
  const [state, setState] = useState<CompleteState>({ status: 'sending' });
  const idempotencyKey = useRef<string | null>(null);

  const deliver = useCallback(async () => {
    if (!recipient) return;
    if (!idempotencyKey.current) {
      idempotencyKey.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : generateUuidFallback();
    }
    setState({ status: 'sending' });
    try {
      const preflight = await preflightGift({
        productId: product.productId,
        recipientUserId: recipient.userId,
        quantity,
      });
      const result = await sendGift(
        {
          productId: product.productId,
          recipientUserId: recipient.userId,
          quantity,
          expectedUnitPrice: preflight.product.unitPrice,
        },
        idempotencyKey.current,
      );
      setState({ status: 'done', result, warning: preflight.preferenceWarning });
    } catch (reason) {
      setState({
        status: 'error',
        message: reason instanceof Error ? reason.message : '선물 전송에 실패했습니다.',
      });
    }
  }, [product.productId, quantity, recipient]);

  useEffect(() => {
    void deliver();
  }, [deliver]);

  if (state.status === 'sending') {
    return (
      <section className="page complete-page">
        <ScreenHeader title="완료" />
        <div className="cursor-status">
          <span className="loading-dot" />
          선물을 전달하는 중
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="page complete-page">
        <ScreenHeader title="완료" />
        <p className="cursor-status" role="alert">
          {state.message}
        </p>
        <div className="complete-actions">
          <button type="button" className="primary" onClick={() => void deliver()}>
            다시 시도
          </button>
          <button type="button" className="secondary" onClick={onFriends}>
            친구 화면으로
          </button>
        </div>
      </section>
    );
  }

  const { result } = state;
  return (
    <section className="page complete-page">
      <ScreenHeader title="완료" />
      <img
        className="complete-image"
        src={result.product.imageUrl || product.thumbnailUrl || PRODUCT_IMAGE}
        alt={`선물한 ${result.product.productName}`}
        draggable={false}
      />
      <p className="delivery-message">
        <strong>{result.product.productName}</strong> 선물이 전달됐어요
      </p>
      <article className="summary-card">
        <dl>
          <dt>받는 분</dt>
          <dd>{result.recipientName}</dd>
          <dt>수량</dt>
          <dd>{result.product.quantity}개</dd>
          <dt>최종 결제 금액</dt>
          <dd>{result.product.totalPrice.toLocaleString()}원</dd>
        </dl>
      </article>
      {state.warning ? (
        <p className="field-error">
          {state.warning.categoryName} 카테고리는 {result.recipientName}님이 선호하지 않을 수 있어요
        </p>
      ) : null}
      <div className="complete-actions">
        <button type="button" className="primary" onClick={onFriends}>
          친구 화면으로
        </button>
      </div>
    </section>
  );
}
