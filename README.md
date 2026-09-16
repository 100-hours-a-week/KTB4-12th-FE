# KTB4-12th-FE

KTB4 12기 12팀 선물 추천 모바일 프론트엔드 프로토타입입니다.

## 실행

```bash
cd prototype
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

브라우저에서 `http://127.0.0.1:4173/`을 엽니다.

## 개발 규칙

프로토타입 디렉터리에서 아래 명령을 사용합니다.

```bash
cd prototype
npm ci
npm run check
```

Node.js `24.19.0`과 npm `11.x`를 기준으로 합니다. nvm을 사용한다면 `nvm use`로
`prototype/.nvmrc`의 버전을 적용할 수 있습니다.

- `npm run lint`: ESLint로 React, TypeScript, Hooks 규칙을 검사합니다.
- `npm run lint:fix`: 자동으로 고칠 수 있는 린트 문제를 수정합니다.
- `npm run format`: Prettier로 파일을 정리합니다.
- `npm run format:check`: 포맷 변경 없이 규칙 준수 여부만 검사합니다.
- `npm run typecheck`: TypeScript 타입을 검사합니다.
- `npm run check`: 포맷, 린트, 타입 검사를 차례로 실행합니다.

에디터는 루트의 `.editorconfig`와 `.prettierrc.json`을 기준으로 설정합니다.
커밋 시 Husky가 변경된 파일에 ESLint와 Prettier를 자동 적용한 뒤 전체 빌드를 실행합니다.
두 검사 중 하나라도 실패하면 커밋을 중단합니다.

## API 연결

기본값은 API 명세와 같은 응답 구조를 사용하는 커서 기반 더미 API입니다. 실제
백엔드 연결 시 `prototype/.env.example`을 `prototype/.env.local`로 복사하고
다음 값을 설정합니다.

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://api.example.com
```

인증이 필요한 요청은 `localStorage`의 `accessToken`을 Bearer 토큰으로
사용합니다. 친구 목록·친구 검색·상품 목록·받은 선물 목록은 서버가 반환한
`pagination.nextCursor`와 `pagination.hasNext`를 기준으로 다음 20건을 불러옵니다.

## 검증

```bash
cd prototype
npm run check:runtime
npm run build
npm run test:sites
npm run test:runtime
```

## Docker

```bash
cd prototype
docker build -t ktb4-12th-fe .
docker run --rm -p 8080:80 ktb4-12th-fe
```

빌드는 `node:24.19.0-alpine3.24`, 런타임은
`nginx:stable-alpine3.24`를 사용합니다. 모바일 프로토타입 런타임의 Vite
출력인 `/app/dist/client`를 Nginx 서비스 경로
`/usr/share/nginx/html`로 복사합니다.
