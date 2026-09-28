export type SignupTerm = {
  termId: number;
  termCode: string;
  title: string;
  version: number;
  isRequired: boolean;
  content: string;
};

export type SignupTermConsent = {
  termId: number;
  version: number;
  isAgreed: boolean;
};

export type SignupRequest = {
  name: string;
  birth: string;
  email: string;
  password: string;
  termConsents: SignupTermConsent[];
};

export type LoginResult = {
  accessToken: string;
  // 백엔드는 refresh token을 HttpOnly 쿠키로 내려주므로 응답 body에는 없을 수 있다.
  refreshToken?: string;
  expiresIn: number;
  user: {
    userId: number;
    name: string;
    email: string;
  };
  isFirstLogin: boolean;
};

export const mockSignupTerms: SignupTerm[] = [
  {
    termId: 1,
    termCode: 'PRIVACY_COLLECTION_USE',
    title: '개인정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '약관 본문',
  },
  {
    termId: 2,
    termCode: 'GIFT_HISTORY_DATA_USE',
    title: '선물 송수신 이력 정보 수집 및 이용 동의서',
    version: 3,
    isRequired: true,
    content: '약관 본문',
  },
  {
    termId: 3,
    termCode: 'MARKETING',
    title: '마케팅 정보 수신 동의서',
    version: 1,
    isRequired: false,
    content: '약관 본문',
  },
];
