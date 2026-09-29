import {
  CookieIcon,
  DotsHorizontalIcon,
  FaceIcon,
  HobbyKnifeIcon,
  HomeIcon,
  LaptopIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons';

import type { CategoryIcon } from './icons';
import { FashionIcon, FoodIcon, PetIcon, VoucherIcon } from './icons';

export type { CategoryIcon } from './icons';

export const categories: Array<{ categoryId: number; name: string; Icon: CategoryIcon }> = [
  { categoryId: 1, name: '뷰티', Icon: MagicWandIcon },
  { categoryId: 2, name: '패션', Icon: FashionIcon },
  { categoryId: 3, name: '카페·디저트', Icon: CookieIcon },
  { categoryId: 4, name: '식품', Icon: FoodIcon },
  { categoryId: 5, name: '생활', Icon: HomeIcon },
  { categoryId: 6, name: '디지털·가전', Icon: LaptopIcon },
  { categoryId: 7, name: '취미·여가', Icon: HobbyKnifeIcon },
  { categoryId: 8, name: '유아·키즈', Icon: FaceIcon },
  { categoryId: 9, name: '반려동물', Icon: PetIcon },
  { categoryId: 10, name: '상품권', Icon: VoucherIcon },
];

export const categoryTree = [
  {
    ...categories[0],
    children: ['스킨케어', '메이크업', '향수', '바디·핸드케어', '헤어케어', '뷰티소품'],
  },
  { ...categories[1], children: ['의류', '가방·지갑', '신발', '주얼리·귀금속', '패션소품'] },
  {
    ...categories[2],
    children: ['케이크', '베이커리', '커피·차·음료', '아이스크림', '과자·간식', '떡·한과'],
  },
  {
    ...categories[3],
    children: [
      '건강식품',
      '과일·견과',
      '정육·수산',
      '가공식품·간편식',
      '외식',
      '조미료·오일',
      '주류',
    ],
  },
  {
    ...categories[4],
    children: [
      '인테리어·가구',
      '홈프래그런스',
      '침구·패브릭',
      '주방용품',
      '욕실용품',
      '청소·세탁용품',
      '문구',
      '차량용품',
    ],
  },
  {
    ...categories[5],
    children: [
      '모바일·PC',
      '영상·음향기기',
      '카메라',
      '게임·주변기기',
      '생활가전',
      '주방가전',
      '건강가전',
      '뷰티가전',
    ],
  },
  {
    ...categories[6],
    children: [
      '도서·음반',
      '보드게임·퍼즐',
      '취미·수집용품',
      '스포츠·레저용품',
      '여행용품',
      '공연·전시·체험',
    ],
  },
  { ...categories[7], children: ['완구', '출산·육아용품', '아동의류·잡화', '학습·교구'] },
  { ...categories[8], children: ['사료·간식', '장난감', '생활·외출용품', '위생·미용용품'] },
  { ...categories[9], children: ['카페·외식 상품권', '쇼핑·생활 상품권', '문화·여가 상품권'] },
].map((category) => ({
  ...category,
  children: category.children.map((name, index) => ({
    categoryId: [11, 17, 22, 28, 35, 43, 51, 57, 61, 65][category.categoryId - 1] + index,
    name,
  })),
}));

const categoryIconAliases: Array<{ keywords: string[]; Icon: CategoryIcon }> = [
  { keywords: ['상품권', '기프티콘'], Icon: VoucherIcon },
  { keywords: ['반려동물', '펫'], Icon: PetIcon },
  { keywords: ['유아', '키즈', '아동', '육아'], Icon: FaceIcon },
  { keywords: ['뷰티', '화장품', '미용'], Icon: MagicWandIcon },
  { keywords: ['카페', '디저트', '커피', '음료'], Icon: CookieIcon },
  { keywords: ['식품', '음식'], Icon: FoodIcon },
  { keywords: ['패션', '의류', '잡화'], Icon: FashionIcon },
  { keywords: ['테크', '디지털', '가전', '전자'], Icon: LaptopIcon },
  { keywords: ['생활', '리빙', '주방', '가구'], Icon: HomeIcon },
  { keywords: ['취미', '여가', '스포츠'], Icon: HobbyKnifeIcon },
  { keywords: ['건강', '헬스'], Icon: FoodIcon },
];

function normalizeCategoryName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s/&·_-]/g, '');
}

export function getCategoryIcon(categoryId: number, name: string): CategoryIcon {
  const category = categories.find((item) => item.categoryId === categoryId);
  if (category) return category.Icon;

  const parentCategory = categoryTree.find((item) =>
    item.children.some((child) => child.categoryId === categoryId),
  );
  if (parentCategory) return parentCategory.Icon;

  const normalizedName = normalizeCategoryName(name);
  const match = categoryIconAliases.find(({ keywords }) =>
    keywords.some((keyword) => normalizedName.includes(normalizeCategoryName(keyword))),
  );

  return match?.Icon ?? DotsHorizontalIcon;
}
