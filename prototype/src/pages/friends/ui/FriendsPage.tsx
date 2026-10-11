import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Cross1Icon,
  DotsHorizontalIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { type ReactNode, useCallback, useRef, useState } from 'react';

import {
  fetchFriendRequests,
  fetchFriends,
  type Friend,
  type FriendRequest,
  type FriendRequestAction,
  type FriendRequestDirection,
} from '../../../entities/friend';
import { KeyboardInput, useKeyboard, useScreenPortal } from '../../../mobile';
import { recoverQaScenario } from '../../../shared/config/qaScenario';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor, ScreenHeader } from '../../../shared/ui';

export function FriendsPage({
  refreshKey,
  view,
  onViewChange,
  action,
  onAdd,
  onGift,
  onRequestAction,
  onRemove,
}: {
  refreshKey: number;
  view: 'friends' | FriendRequestDirection;
  onViewChange: (view: 'friends' | FriendRequestDirection) => void;
  action?: ReactNode;
  onAdd: () => void;
  onGift: (friend: Friend) => void;
  onRequestAction: (request: FriendRequest, action: FriendRequestAction) => void;
  onRemove: (friend: Friend) => void;
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
    <section className="page friend-page">
      <ScreenHeader title="친구" action={action} />
      <div className="friend-tabs" role="tablist" aria-label="친구 목록 종류">
        {(['friends', 'received', 'sent'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            onClick={() => {
              keyboard.hide();
              onViewChange(tab);
            }}
          >
            {{ friends: '친구 목록', received: '받은 요청', sent: '보낸 요청' }[tab]}
          </button>
        ))}
      </div>
      {view !== 'friends' ? (
        <FriendRequests
          key={view}
          direction={view}
          refreshKey={refreshKey}
          onAction={onRequestAction}
        />
      ) : (
        <>
          <div className="gift-search-row">
            <div className="inline-search friend-search-field">
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
              <button
                type="button"
                className="friend-add-filter"
                aria-label="친구 추가"
                onClick={onAdd}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
          <div className="friend-list">
            {list.items.map((friend) => (
              <article className="friend-card" key={friend.friendId}>
                <div className="friend-identity">
                  <strong>{friend.name}</strong>
                  <small>
                    {friend.birth
                      ? `생일 ${friend.birth.slice(-5).replace('-', '월 ')}일`
                      : '생일 비공개'}
                  </small>
                  <span>{friend.email}</span>
                </div>
                <FriendActions friend={friend} onGift={onGift} onRemove={onRemove} />
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
        </>
      )}
    </section>
  );
}

function FriendRequests({
  direction,
  refreshKey,
  onAction,
}: {
  direction: FriendRequestDirection;
  refreshKey: number;
  onAction: (request: FriendRequest, action: FriendRequestAction) => void;
}) {
  const loader = useCallback(
    (cursor: string | null) => fetchFriendRequests(direction, cursor),
    [direction],
  );
  const list = useCursorList(loader, `${direction}:${refreshKey}`);
  return (
    <>
      <p className="friend-request-description">
        {direction === 'received'
          ? '나에게 도착한 친구 요청이에요.'
          : '상대방의 수락을 기다리고 있어요.'}
      </p>
      <div className="friend-list">
        {list.items.map((request) => (
          <article className="friend-card" key={request.requestId}>
            <div className="friend-identity">
              <strong>
                {direction === 'received' ? request.requesterName : request.receiverName}
              </strong>
              <small>{new Date(request.createdAt).toLocaleDateString('ko-KR')} 요청</small>
            </div>
            <div className="friend-request-actions">
              {direction === 'received' ? (
                <>
                  <button className="pill-button" onClick={() => onAction(request, 'accept')}>
                    수락
                  </button>
                  <button
                    className="pill-button friend-request-secondary"
                    onClick={() => onAction(request, 'reject')}
                  >
                    거절
                  </button>
                </>
              ) : (
                <button
                  className="pill-button friend-request-secondary"
                  onClick={() => onAction(request, 'cancel')}
                >
                  요청 취소
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel={
          direction === 'received' ? '받은 친구 요청이 없어요' : '보낸 친구 요청이 없어요'
        }
        onLoadMore={list.loadMore}
        onRetry={list.retry}
      />
    </>
  );
}

function FriendActions({
  friend,
  onGift,
  onRemove,
}: {
  friend: Friend;
  onGift: (friend: Friend) => void;
  onRemove: (friend: Friend) => void;
}) {
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choosingRemoval = useRef(false);
  return (
    <div className="friend-card-actions">
      <button type="button" className="pill-button" onClick={() => onGift(friend)}>
        선물하기
      </button>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(open) => {
          if (open) {
            keyboard.hide();
            setMenuContainer(screenRef.current);
            choosingRemoval.current = false;
          }
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            className="friend-more-trigger"
            aria-label={`${friend.name} 친구 메뉴`}
          >
            <DotsHorizontalIcon />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={menuContainer ?? undefined}>
          <DropdownMenu.Content
            className="friend-action-menu"
            align="end"
            sideOffset={4}
            collisionBoundary={menuContainer ?? undefined}
            onCloseAutoFocus={(event) => {
              // The confirmation dialog owns focus after selecting delete.
              if (choosingRemoval.current) event.preventDefault();
            }}
          >
            <DropdownMenu.Item
              className="friend-delete-item"
              aria-label={`${friend.name} 친구 삭제`}
              onSelect={() => {
                choosingRemoval.current = true;
                trigger.current?.focus({ preventScroll: true });
                onRemove(friend);
              }}
            >
              <TrashIcon /> 친구 삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
