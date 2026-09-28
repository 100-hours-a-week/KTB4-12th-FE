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
    content: `필수 개인정보 수집 및 이용 안내

1. 수집하는 개인정보
회원가입 및 계정 관리를 위해 이름, 생년월일, 이메일 주소와 비밀번호를 수집합니다.

2. 수집·이용 목적
계정 관리, 연령 확인, 친구 검색·목록 및 선물 수신자 식별에 이용합니다.

3. 보유 및 이용 기간
회원 탈퇴 시까지 보유·이용하며, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 안전하게 보관합니다.

4. 동의 거부 권리
동의를 거부할 수 있습니다. 필수 정보에 동의하지 않으면 회원가입이 제한됩니다.`,
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
