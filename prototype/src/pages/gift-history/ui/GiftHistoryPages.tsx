import { useCallback } from 'react';

import {
  fetchReceivedGifts,
  fetchSentGifts,
  type ReceivedGift,
  type SentGift,
} from '../../../entities/gift';
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
          <GiftCard gift={gift} direction="from" key={gift.giftId} />
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

export function SentGiftsPage({ onBack }: { onBack: () => void }) {
  const loader = useCallback((cursor: string | null) => fetchSentGifts(cursor), []);
  const list = useCursorList(loader, 'sent');
  return (
    <section className="page received-page">
      <ScreenHeader title="보낸 선물" onBack={onBack} />
      <div className="received-list">
        {list.items.map((gift) => (
          <SentGiftCard gift={gift} key={gift.giftId} />
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel="보낸 선물이 없어요"
        onLoadMore={list.loadMore}
        onRetry={list.retry}
      />
    </section>
  );
}

function GiftCard({ gift, direction }: { gift: ReceivedGift; direction: 'from' | 'to' }) {
  const person = gift.sender.name;
  const dateLabel = direction === 'from' ? '받은 날짜' : '보낸 날짜';
  return (
    <article className="received-card">
      <strong>
        {direction}. {person}
      </strong>
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
      <small>
        {dateLabel}: {new Date(gift.receivedAt).toLocaleDateString('ko-KR')}
      </small>
    </article>
  );
}

function SentGiftCard({ gift }: { gift: SentGift }) {
  return (
    <article className="received-card">
      <strong>to. {gift.recipient.name}</strong>
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
      <small>보낸 날짜: {new Date(gift.sentAt).toLocaleDateString('ko-KR')}</small>
    </article>
  );
}
