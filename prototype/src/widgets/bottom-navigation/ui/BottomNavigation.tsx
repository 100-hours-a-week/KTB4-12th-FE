import { AvatarIcon, PersonIcon } from '@radix-ui/react-icons';
import type { ComponentType } from 'react';

import type { MainTabRoute, Route } from '../../../shared/model/navigation';
import { GiftIcon } from '../../../shared/ui';

const items: Array<{ route: MainTabRoute; label: string; Icon: ComponentType }> = [
  { route: 'friends', label: '친구', Icon: PersonIcon },
  { route: 'gifts', label: '선물', Icon: GiftIcon },
  { route: 'mypage', label: '마이', Icon: AvatarIcon },
];

export function BottomNavigation({
  route,
  onSelect,
}: {
  route: Route;
  onSelect: (route: MainTabRoute) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {items.map(({ route: itemRoute, label, Icon }) => (
        <button
          type="button"
          className={route === itemRoute ? 'active' : ''}
          aria-current={route === itemRoute ? 'page' : undefined}
          onClick={() => onSelect(itemRoute)}
          key={itemRoute}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
