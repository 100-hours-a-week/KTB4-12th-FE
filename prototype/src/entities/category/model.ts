import {
  ArchiveIcon,
  BackpackIcon,
  CookieIcon,
  FaceIcon,
  HeartIcon,
  HomeIcon,
  LaptopIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons';

export type CategoryIcon = typeof HomeIcon;

export const categories: Array<{ name: string; Icon: CategoryIcon }> = [
  { name: '뷰티', Icon: HeartIcon },
  { name: '카페/디저트', Icon: CookieIcon },
  { name: '패션', Icon: BackpackIcon },
  { name: '테크', Icon: LaptopIcon },
  { name: '생활', Icon: HomeIcon },
  { name: '취미', Icon: MagicWandIcon },
  { name: '건강', Icon: FaceIcon },
  { name: '기타', Icon: ArchiveIcon },
];
