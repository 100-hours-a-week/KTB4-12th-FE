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
