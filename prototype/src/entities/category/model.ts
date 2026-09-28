import {
  CookieIcon,
  DotsHorizontalIcon,
  HeartFilledIcon,
  HobbyKnifeIcon,
  HomeIcon,
  LaptopIcon,
  MagicWandIcon,
  SewingPinFilledIcon,
} from '@radix-ui/react-icons';

export type CategoryIcon = typeof HomeIcon;

export const categories: Array<{ name: string; Icon: CategoryIcon }> = [
  { name: '뷰티', Icon: MagicWandIcon },
  { name: '카페/디저트', Icon: CookieIcon },
  { name: '패션', Icon: SewingPinFilledIcon },
  { name: '테크', Icon: LaptopIcon },
  { name: '생활', Icon: HomeIcon },
  { name: '취미', Icon: HobbyKnifeIcon },
  { name: '건강', Icon: HeartFilledIcon },
  { name: '기타', Icon: DotsHorizontalIcon },
];
