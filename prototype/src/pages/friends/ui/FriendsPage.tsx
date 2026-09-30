import { Cross1Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useCallback, useState } from 'react';

import { fetchFriends, type Friend } from '../../../entities/friend';
import { KeyboardInput, useKeyboard } from '../../../mobile';
import { recoverQaScenario } from '../../../shared/config/qaScenario';
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
  const [searchInput, setSearchInput] = useState('');
  const [searchEditing, setSearchEditing] = useState(false);
  const keyboard = useKeyboard();
  const searchQuery = searchInput.trim();
  const loader = useCallback(
    (cursor: string | null) => fetchFriends(cursor, searchQuery),
    [searchQuery],
  );
  const list = useCursorList(loader, `${searchQuery}:${refreshKey}`);

  return (
    <section className="page">
      <ScreenHeader title="친구" />
      <div className="gift-search-row">
        <div className="inline-search">
          <MagnifyingGlassIcon />
          {searchEditing ? (
            <KeyboardInput
              autoFocus
              aria-label="친구 이름 검색"
              placeholder="친구 이름 검색"
              value={searchInput}
              onBlur={() => {
                setSearchEditing(false);
                keyboard.hide();
              }}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          ) : (
            <button
              type="button"
              className={`inline-search-trigger ${searchInput ? 'has-value' : ''}`}
              aria-label="친구 이름 검색"
              onClick={() => setSearchEditing(true)}
            >
              {searchInput || '친구 이름 검색'}
            </button>
          )}
          {searchInput ? (
            <button
              type="button"
              className="clear-search"
              aria-label="검색어 지우기"
              onClick={() => setSearchInput('')}
            >
              <Cross1Icon />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="filter-button friend-add-filter"
          aria-label="친구 추가"
          onClick={onAdd}
        >
          <PlusIcon />
        </button>
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
        emptyLabel={searchQuery ? '검색 결과가 없어요' : '등록된 친구가 없어요'}
        onLoadMore={list.loadMore}
        onRetry={() => {
          recoverQaScenario('friend-list-error');
          list.retry();
        }}
      />
    </section>
  );
}
