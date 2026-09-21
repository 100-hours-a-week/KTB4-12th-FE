import { Cross1Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useCallback, useState } from 'react';

import { fetchFriends, type Friend } from '../../../entities/friend';
import { KeyboardInput, useKeyboard } from '../../../mobile';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor, ScreenHeader } from '../../../shared/ui';

export function FriendsPage({
  refreshKey,
  onAdd,
  onGift,
}: {
  refreshKey: number;
  onAdd: () => void;
  onGift: (friend: Friend) => void;
}) {
  const [search, setSearch] = useState('');
  const [searchEditing, setSearchEditing] = useState(false);
  const keyboard = useKeyboard();
  const loader = useCallback((cursor: string | null) => fetchFriends(cursor, search), [search]);
  const list = useCursorList(loader, `${search}:${refreshKey}`);

  return (
    <section className="page">
      <ScreenHeader
        title="친구"
        action={
          <button type="button" className="icon-button dark" aria-label="친구 추가" onClick={onAdd}>
            <PlusIcon />
          </button>
        }
      />
      <div className="inline-search">
        <MagnifyingGlassIcon />
        {searchEditing ? (
          <KeyboardInput
            autoFocus
            aria-label="친구 이름 검색"
            placeholder="친구 이름 검색"
            value={search}
            onBlur={() => {
              setSearchEditing(false);
              keyboard.hide();
            }}
            onChange={(event) => setSearch(event.target.value)}
          />
        ) : (
          <button
            type="button"
            className={`inline-search-trigger ${search ? 'has-value' : ''}`}
            aria-label="친구 이름 검색"
            onClick={() => setSearchEditing(true)}
          >
            {search || '친구 이름 검색'}
          </button>
        )}
        {search ? (
          <button
            type="button"
            className="clear-search"
            aria-label="검색어 지우기"
            onClick={() => setSearch('')}
          >
            <Cross1Icon />
          </button>
        ) : null}
      </div>
      <div className="friend-list">
        {list.items.map((friend) => (
          <article className="friend-card" key={friend.friendId}>
            <div>
              <strong>{friend.name}</strong>
              <small>
                {friend.birth
                  ? `생일 ${friend.birth.slice(-5).replace('-', '월 ')}일`
                  : '생일 비공개'}
              </small>
              <span>{friend.email}</span>
            </div>
            <button type="button" className="pill-button" onClick={() => onGift(friend)}>
              선물하기
            </button>
          </article>
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel={search ? '검색 결과가 없어요' : '등록된 친구가 없어요'}
        onLoadMore={list.loadMore}
        onRetry={list.retry}
      />
    </section>
  );
}
