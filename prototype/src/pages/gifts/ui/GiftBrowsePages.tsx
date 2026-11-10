import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Cross1Icon,
  DotsHorizontalIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MixerHorizontalIcon,
  Pencil1Icon,
  PlusIcon,
} from '@radix-ui/react-icons';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchProductDetail,
  fetchProducts,
  type Product,
  type ProductDetail,
  type ProductSort,
} from '../../../entities/product';
import { KeyboardInput, useKeyboard, useScreenPortal } from '../../../mobile';
import { DEFAULT_PRODUCT_IMAGE } from '../../../shared/config/assets';
import { getAiProfileQaStatus, recoverQaScenario } from '../../../shared/config/qaScenario';
import { useCursorList } from '../../../shared/lib/useCursorList';
import {
  GiftIcon,
  InfiniteCursor,
  ProductImage,
  ScreenHeader,
  SettingRow,
} from '../../../shared/ui';

const PRODUCT_SORT_OPTIONS: ReadonlyArray<{
  label: string;
  value: ProductSort;
}> = [
  { label: 'AI 추천순', value: 'AI_RECOMMENDED' },
  { label: '인기순', value: 'POPULAR' },
  { label: '구매순', value: 'MOST_GIFTED' },
];

const PRODUCT_SEARCH_MAX_LENGTH = 100;
const PRODUCT_SEARCH_DEBOUNCE_MS = 300;

export function GiftsPage({
  filterCount,
  filterCategoryIds,
  onFilter,
  onProduct,
  recipientName,
  recipientUserId,
  onSelectRecipient,
  onClearRecipient,
  action,
}: {
  filterCount: number;
  filterCategoryIds: number[];
  onFilter: () => void;
  onProduct: (product: Product) => void;
  recipientName?: string;
  recipientUserId?: number;
  onSelectRecipient: () => void;
  onClearRecipient: () => void;
  action?: ReactNode;
}) {
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null);
  const choosingRecipient = useRef(false);
  const [sort, setSort] = useState<ProductSort>(recipientUserId ? 'AI_RECOMMENDED' : 'POPULAR');
  const [sortRecipientId, setSortRecipientId] = useState(recipientUserId);
  if (sortRecipientId !== recipientUserId) {
    setSortRecipientId(recipientUserId);
    setSort(recipientUserId || sort === 'AI_RECOMMENDED' ? 'AI_RECOMMENDED' : 'POPULAR');
  }
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const normalizedSearchInput = searchInput.trim();
  useEffect(() => {
    if (!normalizedSearchInput && searchInput) return;
    const timer = window.setTimeout(
      () => setSearch(normalizedSearchInput),
      PRODUCT_SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedSearchInput, searchInput]);
  const needsRecipient = sort === 'AI_RECOMMENDED' && !recipientUserId;
  const loader = useCallback(
    (cursor: string | null) =>
      needsRecipient
        ? Promise.resolve({ items: [], pagination: { nextCursor: null, hasNext: false } })
        : fetchProducts(cursor, search, sort, filterCategoryIds, recipientUserId),
    [search, sort, filterCategoryIds, recipientUserId, needsRecipient],
  );
  const list = useCursorList(
    loader,
    JSON.stringify([recipientUserId, search, sort, filterCategoryIds]),
  );

  return (
    <section className="page gifts-page">
      <ScreenHeader title="선물 탐색" action={action} />
      {!needsRecipient && (
        <AiProfileQaPanel
          status={getAiProfileQaStatus()}
          recipientName={recipientName}
          products={list.items.slice(0, 2)}
          onProduct={onProduct}
        />
      )}
      <div className="gift-search-row">
        <div className="inline-search">
          <MagnifyingGlassIcon aria-hidden="true" />
          <KeyboardInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="상품명 또는 브랜드를 입력해 주세요."
            maxLength={PRODUCT_SEARCH_MAX_LENGTH}
          />
        </div>
        <button
          type="button"
          className="filter-button"
          aria-label={filterCount ? `필터, ${filterCount}개 선택됨` : '필터'}
          onClick={onFilter}
        >
          <MixerHorizontalIcon />
          {filterCount ? <b>{filterCount}</b> : null}
        </button>
      </div>
      <div className="sort-row" role="radiogroup" aria-label="상품 정렬">
        <span>정렬</span>
        {PRODUCT_SORT_OPTIONS.map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={sort === option.value}
            key={option.value}
            onClick={() => setSort(option.value)}
          >
            <span className={sort === option.value ? 'radio active' : 'radio'} />
            {option.label}
          </button>
        ))}
      </div>
      {needsRecipient ? (
        <div className="browse-recipient-prompt">
          <GiftIcon />
          <strong>누구에게 선물할까요?</strong>
          <p>받는 사람을 선택하면 맞춤 추천 상품을 보여드려요.</p>
          <button type="button" className="primary" onClick={onSelectRecipient}>
            받는 사람 선택
          </button>
        </div>
      ) : (
        <>
          {recipientUserId ? (
            <div className="browse-recipient-row">
              <span>{recipientName}님에게 줄 선물</span>
              <DropdownMenu.Root
                modal={false}
                onOpenChange={(open) => {
                  if (open) {
                    keyboard.hide();
                    setMenuContainer(screenRef.current);
                    choosingRecipient.current = false;
                  }
                }}
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="recipient-more-trigger"
                    aria-label="받는 사람 메뉴"
                  >
                    <DotsHorizontalIcon aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal container={menuContainer ?? undefined}>
                  <DropdownMenu.Content
                    className="recipient-action-menu"
                    align="end"
                    sideOffset={4}
                    collisionBoundary={menuContainer ?? undefined}
                    onCloseAutoFocus={(event) => {
                      if (choosingRecipient.current) event.preventDefault();
                    }}
                  >
                    <DropdownMenu.Item
                      className="recipient-menu-item"
                      onSelect={() => {
                        choosingRecipient.current = true;
                        onSelectRecipient();
                      }}
                    >
                      <Pencil1Icon aria-hidden="true" /> 받는 사람 변경
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="recipient-menu-item" onSelect={onClearRecipient}>
                      <Cross1Icon aria-hidden="true" /> 선택 해제
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ) : null}
          {sort === 'AI_RECOMMENDED' && list.metadata === 'POPULAR' ? (
            <p className="browse-sort-notice" role="status">
              현재 조건에 맞는 AI 추천 상품이 없어 인기순으로 보여드려요.
            </p>
          ) : null}
          {list.errorCode === 'RECIPIENT_NOT_FOUND' ? (
            <p className="field-error" role="alert">
              선택한 수신자 정보를 확인할 수 없어요. 받는 사람을 다시 선택해 주세요.
            </p>
          ) : null}
          <div className="product-grid">
            {list.items.map((product) => (
              <button
                type="button"
                className="product-card"
                onClick={() => onProduct(product)}
                key={product.productId}
              >
                <span className="product-card-image">
                  <ProductImage src={product.thumbnailUrl} alt={product.productName} />
                </span>
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
            onRetry={() => {
              recoverQaScenario('product-list-error');
              list.retry();
            }}
          />
        </>
      )}
    </section>
  );
}

function AiProfileQaPanel({
  status,
  recipientName,
  products,
  onProduct,
}: {
  status: 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  recipientName?: string;
  products: Product[];
  onProduct: (product: Product) => void;
}) {
  if (!status) return null;
  const name = recipientName ?? '받는 분';
  return (
    <section className={`ai-profile-panel ${status.toLowerCase()}`} aria-live="polite">
      <strong>{name}님을 위한 맞춤 추천</strong>
      {status === 'NONE' ? <p>아직 맞춤 추천을 준비할 취향 정보가 부족해요.</p> : null}
      {status === 'PENDING' ? (
        <p>
          <span className="loading-dot" /> 취향을 분석하고 있어요.
        </p>
      ) : null}
      {status === 'FAILED' ? (
        <p>맞춤 추천을 불러오지 못했어요. 일반 상품을 둘러봐 주세요.</p>
      ) : null}
      {status === 'COMPLETED' ? (
        <div className="ai-profile-products">
          {products.map((product) => (
            <button type="button" key={product.productId} onClick={() => onProduct(product)}>
              <ProductImage src={product.thumbnailUrl} alt={product.productName} />
              <span>{product.productName}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type ProductPageProps = {
  product: Product;
  initialDetail?: ProductDetail | null;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onBack: () => void;
  onGift: () => void;
  action?: ReactNode;
};

export function ProductPage({
  product,
  initialDetail,
  quantity,
  onDecrease,
  onIncrease,
  onBack,
  onGift,
  action,
}: ProductPageProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(initialDetail ?? null);
  const detailRequest = useRef<Promise<ProductDetail> | null>(null);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (initialDetail) return;
    // StrictMode replays effects; share only this screen visit's in-flight request.
    detailRequest.current ??= fetchProductDetail(product.productId);
    detailRequest.current
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
  }, [product.productId, initialDetail]);

  const price = detail?.unitPrice ?? product.price;
  const soldOut = detail !== null && detail.stockQuantity <= 0;
  const heroImage = detail
    ? detail.images[0]?.imageUrl || DEFAULT_PRODUCT_IMAGE
    : product.thumbnailUrl || DEFAULT_PRODUCT_IMAGE;

  return (
    <section className="page product-detail">
      <ScreenHeader title="상품 상세" onBack={onBack} action={action} />
      <div className="product-detail-surface">
        <ProductImage
          className="product-hero"
          src={heroImage}
          alt={`${product.brandName} ${product.productName}`}
        />
        <article className="detail-card product-detail-heading">
          <small>{product.brandName}</small>
          <strong>{product.productName}</strong>
          <SettingRow label="상품 금액" value={`${price.toLocaleString()}원`} />
        </article>
        <article className="detail-card product-description">
          <small>상품 설명</small>
          <p>{detail?.description ?? '상품 정보를 불러오는 중이에요.'}</p>
        </article>
      </div>
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
      <button
        type="button"
        className="primary product-cta"
        disabled={soldOut || detail === null || Boolean(detailError)}
        onClick={onGift}
      >
        <GiftIcon /> 선물하기 <span>{(price * quantity).toLocaleString()}원</span>
      </button>
    </section>
  );
}
