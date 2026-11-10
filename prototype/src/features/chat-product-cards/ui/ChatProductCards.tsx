import { useState } from 'react';

import type { ChatProduct } from '../../../entities/chat';
import type { Product, ProductDetail } from '../../../entities/product';
import { type CardState, ChatProducts, productImage } from '../model/ChatProducts';

function CardImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return src && src !== failed ? (
    <img
      className="ai-chat-product-image"
      src={src}
      alt={name}
      draggable={false}
      onError={() => setFailed(src)}
    />
  ) : (
    <span
      className="ai-chat-product-image ai-chat-product-placeholder"
      role="img"
      aria-label="상품 이미지 없음"
    >
      🎁
    </span>
  );
}

export function ChatProductCards({
  products,
  states,
  store,
  onProduct,
}: {
  products: ChatProduct[];
  states: Record<number, CardState>;
  store: ChatProducts;
  onProduct: (product: Product, detail: ProductDetail) => void;
}) {
  return (
    <div className="ai-chat-cards">
      {products.map((card) => {
        const state = states[card.productId];
        const ready = state?.status === 'ready' ? state : null;
        return (
          <article className="ai-chat-card" key={card.productId} data-product-id={card.productId}>
            {ready ? (
              <CardImage src={productImage(ready.product)} name={ready.product.productName} />
            ) : (
              <span
                className="ai-chat-product-image ai-chat-product-placeholder"
                aria-hidden="true"
              >
                🎁
              </span>
            )}
            <div className="ai-chat-product-info">
              <strong>{ready ? ready.product.productName : `추천 상품 #${card.productId}`}</strong>
              {ready ? <p>{ready.product.unitPrice.toLocaleString('ko-KR')}원</p> : null}
              <p>{card.reason}</p>
              <p className="ai-chat-product-status" role="status">
                {ready
                  ? ready.checking
                    ? '판매 상태를 확인하고 있어요.'
                    : ready.product.stockQuantity === 0
                      ? '품절된 상품입니다.'
                      : ''
                  : state?.status === 'error' || state?.status === 'unavailable'
                    ? state.message
                    : '상품 정보를 불러오고 있어요.'}
              </p>
              {state?.status === 'error' ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void store.load(card.productId)}
                >
                  상품 정보 다시 시도
                </button>
              ) : null}
              <button
                type="button"
                className="primary compact"
                disabled={!ready || ready.checking || ready.product.stockQuantity === 0}
                onClick={() => {
                  void store.load(card.productId, true).then((product) => {
                    const latest = store.getSnapshot()[card.productId];
                    if (product && latest?.status === 'ready') onProduct(product, latest.product);
                  });
                }}
              >
                상품 보기
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
