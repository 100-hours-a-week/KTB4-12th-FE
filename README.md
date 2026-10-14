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

로컬 실연동 시 브라우저 주소의 Origin(프로토콜·호스트·포트)이 BE의
`CORS_ALLOWED_ORIGINS`와 정확히 일치해야 합니다. `localhost`와 `127.0.0.1`,
`5173`과 `4173`은 서로 다른 Origin입니다. 현재 BE가 `http://localhost:5173`을
허용한다면 프론트도 해당 주소에서 실행해야 하며, 불일치하면 로그인 전
`OPTIONS` 사전 요청부터 403으로 차단됩니다.

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

### 로컬 Mock QA 시나리오

`prototype/.env.local`에서 `VITE_USE_MOCK_API=true`로 설정하고 개발 서버를 다시 시작한
뒤, 주소에 다음 `qa` 값을 붙이면 오류·경계 상태를 재현할 수 있습니다.

| QA                                          | 주소                               |
| ------------------------------------------- | ---------------------------------- |
| 친구 목록 첫 조회 실패 후 재시도 성공       | `/?qa=friend-list-error`           |
| 상품 목록 첫 조회 실패 후 재시도 성공       | `/?qa=product-list-error`          |
| 상품 이미지 없음                            | `/?qa=product-no-image`            |
| 상품 상세 조회 실패                         | `/?qa=product-detail-error`        |
| 품절 상품                                   | `/?qa=product-sold-out`            |
| 비선호 카테고리 첫 조회 실패 후 재시도 성공 | `/?qa=dislike-category-load-error` |
| 비선호 카테고리 첫 저장 실패 후 재시도 성공 | `/?qa=dislike-category-save-error` |
| 회원가입 시 만 14세 미만 검증 오류          | `/?qa=signup-underage`             |

선택할 수 없는 카테고리 ID 검증은 개발자 도구 Console에서 다음처럼 호출합니다.

```js
const { saveDislikeCategories } = await import('/src/entities/preference/api.ts');
await saveDislikeCategories([999]);
```

`422 DISLIKE_CATEGORY_NOT_AVAILABLE` 오류가 발생하고 기존 선택값은 유지되어야 합니다.

## Docker

```bash
cd prototype
docker build \
  --build-arg VITE_USE_MOCK_API=false \
  --build-arg VITE_API_BASE_URL=/api \
  -t ktb4-12th-fe .
docker run --rm -p 8080:80 ktb4-12th-fe
```

Docker 이미지는 Vite 환경 변수를 정적 번들에 포함하므로 두 build argument를
반드시 전달해야 합니다. 운영 환경에서는 `/api` 요청을 같은 origin의 Backend
proxy로 전달합니다.

빌드는 `node:24.19.0-alpine3.24`, 런타임은
`nginx:stable-alpine3.24`를 사용합니다. 모바일 프로토타입 런타임의 Vite
출력인 `/app/dist/client`를 Nginx 서비스 경로
`/usr/share/nginx/html`로 복사합니다.

## AI 채팅

AI 챗봇 화면은 선택한 수신자로 BE 공개 `/recommendations/conversations` API를
호출합니다. 대화 생성·복구 → 질문 접수 → fetch SSE → 최종 턴 조회·취소 흐름이며,
BE가 AI 서버 통신과 대화 토큰 발급을 담당합니다. FE는 AI 서버를 직접 호출하지 않습니다.

- 입력은 이모지를 포함한 Unicode 코드 포인트 기준 100자입니다.
- 대화·토큰·질문 원문·답변·이벤트 번호·입력·스크롤을 `gift-chat:v1:{userId}`
  sessionStorage 스냅샷으로 저장합니다. 스트림 중에는 400ms 간격으로 저장하고,
  접수·종료·화면 이탈 시 최신 상태를 저장합니다.
- 접수 응답 유실·15초 timeout은 GET 턴으로 확인합니다. 미접수가 확인된 질문은
  사용자가 같은 UUID·Body로 재전송하며, 네트워크 실패를 이유로 질문을 자동 재전송하지 않습니다.
- SSE는 UTF-8·CRLF·빈 줄 경계를 누적 파싱합니다. 중복 ID는 무시하고 누락·파싱 실패·EOF는
  전체 턴 조회로 재동기화합니다. 수신이 60초 동안 없으면 상태를 조회하며 heartbeat도 대기를 갱신합니다.
- 대화 토큰의 `404 / NOT_FOUND`는 같은 대화 UUID·수신자로 생성·복구 API를 호출하여
  재인증합니다. 기존 AI 대화가 사라졌다면 안내와 함께 새 대화 UUID를 준비합니다.
- 화면 이동은 스트림만 닫습니다. 정지 버튼만 body 없는 취소 PUT을 보내며, 응답의 실제
  `PROCESSING / COMPLETED / FAILED / CANCELLED` 상태를 반영합니다.
- 로그아웃은 sessionStorage를 비웁니다. 다른 탭에서 계정이 바뀌면 이전 화면·연결을
  정리하고, 다른 사용자·이전 버전·손상된 저장 기록을 복원하지 않습니다.
- storage 저장 실패 시 현재 화면 대화는 유지됩니다. 이 경우 새로고침 후 복원은 보장되지 않습니다.

기본 mock API에서는 `?chatMock=text`, `long`, `reconnect`, `slow`, `delayed_tokens`,
`failed`, `timeout`, `cards`로 흐름을 재현합니다. mock 기록은 테스트·미리보기용이며 실제 AI 결과가 아닙니다.
실제 연동은 기존 `VITE_USE_MOCK_API=false` 설정을 사용합니다.

채팅 검증은 `tests/chat-parser.spec.ts`, `tests/e2e/chat.spec.ts` 및 실제 API 모드의
`tests/e2e/chat-api.spec.ts`에 있습니다. API 모드 검증은
`npm run test:e2e:api-error -- tests/e2e/chat-api.spec.ts`로 실행합니다.
실제 BE·AI 서비스와의 연동 완료 여부는 mock 및 요청 가로채기 E2E와 별도로 검증해야 합니다.
