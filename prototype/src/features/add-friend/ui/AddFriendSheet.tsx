import { CheckIcon, Cross1Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';

import { searchFriends } from '../../../entities/friend';
import { BottomSheet, KeyboardInput } from '../../../mobile';

type AddFriendSheetProps = {
  open: boolean;
  editing: boolean;
  query: string;
  addedFriends: string[];
  onOpenChange: (open: boolean) => void;
  onStartEditing: () => void;
  onQueryChange: (value: string) => void;
  onToggleFriend: (name: string) => void;
};

export function AddFriendSheet({
  open,
  editing,
  query,
  addedFriends,
  onOpenChange,
  onStartEditing,
  onQueryChange,
  onToggleFriend,
}: AddFriendSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="친구 추가" snap={0.68}>
      <button
        type="button"
        className="sheet-close"
        aria-label="친구 추가 닫기"
        onClick={() => onOpenChange(false)}
      >
        <Cross1Icon />
      </button>
      <div className="friend-search-row">
        <MagnifyingGlassIcon />
        {editing ? (
          <KeyboardInput
            autoFocus
            aria-label="친구 이메일 검색"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이메일을 검색해 주세요"
          />
        ) : (
          <button
            type="button"
            className="friend-search-trigger"
            aria-label="친구 이메일 검색"
            onClick={onStartEditing}
          >
            {query || '이메일을 검색해 주세요'}
          </button>
        )}
        <button type="button" className="search-action">
          검색
        </button>
      </div>
      <div className="friend-results">
        {searchFriends
          .filter((friend) =>
            `${friend.name}${friend.email}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((friend) => {
            const added = addedFriends.includes(friend.name);
            return (
              <article className="friend-result" key={friend.email}>
                <div>
                  <strong>{friend.name}</strong>
                  <span>{friend.email}</span>
                </div>
                <button
                  type="button"
                  className="circle-action"
                  aria-label={`${friend.name} ${added ? '추가됨' : '추가'}`}
                  onClick={() => onToggleFriend(friend.name)}
                >
                  {added ? <CheckIcon /> : <PlusIcon />}
                </button>
              </article>
            );
          })}
      </div>
    </BottomSheet>
  );
}
