import { useCallback } from 'react';

import { fetchReceivedGifts, type ReceivedGift } from '../../../entities/gift';
import { PRODUCT_IMAGE } from '../../../entities/product';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor, ScreenHeader } from '../../../shared/ui';

export function ReceivedGiftsPage({ onBack }: { onBack: () => void }) {
  const loader = useCallback((cursor: string | null) => fetchReceivedGifts(cursor), []);
  const list = useCursorList(loader, 'received');
  return (
    <section className="page received-page">
      <ScreenHeader title="받은 선물" onBack={onBack} />
      <div className="received-list">
        {list.items.map((gift) => (
          <GiftCard gift={gift} key={gift.giftId} />
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel="받은 선물이 없어요"
        onLoadMore={list.loadMore}
        onRetry={list.retry}
      />
    </section>
  );
}

function GiftCard({ gift }: { gift: ReceivedGift }) {
  return (
    <article className="received-card">
      <strong>from. {gift.sender.name}</strong>
      <div>
        <img
          src={gift.product.thumbnailUrl || PRODUCT_IMAGE}
          alt={gift.product.name}
          draggable={false}
        />
        <p>
          {gift.product.brand}
          <br />
          {gift.product.name}
          <br />
          <b>수량 {gift.quantity}개</b>
        </p>
      </div>
      <small>받은 날짜: {new Date(gift.receivedAt).toLocaleDateString('ko-KR')}</small>
    </article>
  );
}
