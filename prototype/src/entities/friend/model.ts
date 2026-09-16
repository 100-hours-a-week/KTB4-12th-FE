export type Friend = {
  friendId: number;
  userId: number;
  name: string;
  email: string;
  birth: string | null;
};

const friendNames = [
  '김민지',
  '이준호',
  '박서연',
  '김우주',
  '김민정',
  '김민주',
  '박민지',
  '최하늘',
  '정다은',
  '한유진',
];

export const mockFriends: Friend[] = Array.from({ length: 46 }, (_, index) => ({
  friendId: index + 31,
  userId: index + 27,
  name: `${friendNames[index % friendNames.length]}${index >= friendNames.length ? ` ${Math.floor(index / friendNames.length) + 1}` : ''}`,
  email: `friend${index + 1}@kakao.co.kr`,
  birth:
    index % 7 === 0
      ? null
      : `2000-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
}));

export const searchFriends = [
  { name: '김민정', email: 'kakaa@kakao.co.kr' },
  { name: '김민주', email: 'kakaminjoo@kakao.co.kr' },
  { name: '박민지', email: 'kakapark@kakao.co.kr' },
  { name: '김우주', email: 'kakawoojoo@kakao.co.kr' },
];
