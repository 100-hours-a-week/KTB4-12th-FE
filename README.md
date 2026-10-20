# KTB4-12th-FE

KTB4 12기 12팀 선물 추천 모바일 프론트엔드 프로토타입입니다.

## V2 정적 배포

- Develop의 Docker·ECR 자동 배포는 유지. main 릴리스 FE는 ECR에 발행하지 않음.
- main CI 통과 후 `VERSION`의 빌드 파일을 비공개 S3 `releases/frontend/<VERSION>/`에 발행. 소스 SHA·파일 SHA256 manifest를 마지막에 기록하며 다른 내용으로 같은 버전 재발행 금지.
- FE 레포의 `Frontend Static Delivery`가 main CI 성공 후 동일 산출물을 스테이징에 배포하고, 운영은 Environment 승인 대기. Cloud 레포는 BE 배포만 담당.
- `frontend-static-delivery.yml`은 main에 반영돼야 workflow_run으로 실행 가능. main PR·릴리스 시점은 풀스택 팀 결정.
- Repository Variable `RELEASE_S3_ROLE_ARN`: main 전용 정적 산출물 발행 Role.
- Environment `fe-v2-staging`, `fe-v2-production`: main 브랜치만 허용. 운영 Required reviewers 지정 필수.
- 각 Environment Variable: `FE_DEPLOY_ROLE_ARN`, `FE_CLOUDFRONT_DISTRIBUTION_ID`, `FE_CD_READY`. 실제 버킷·OAC·API 라우팅·권한 준비 전 준비 플래그 설정 금지.
- 초기 준비 후 수동 실행은 기존 발행 버전과 `dry_run=true`로 먼저 검증. 실제 운영 재배포·복귀도 스테이징 단계와 운영 승인을 통과해야 함.
- S3 서비스 경로는 `frontend/<environment>/`. 환경별 재빌드 없이 `/api` 상대주소 계약 사용. Production의 API 원본·인증·캐시 정책은 별도 준비 필요.
- 자산 먼저/index 마지막, 기존 자산 삭제 없음. 같은 이름의 다른 내용은 중단하므로 해시 파일명 필요. 실패 시 이전 index 복구·CloudFront 무효화. 최초 배포·강제 취소는 수동 복구 가능성 있음.
- 배포 API 검증 성공이 로그인·결제·AI 기능 QA 합격을 의미하지 않음. 운영 승인 전 팀 QA 필요.
- 정적 발행·복구 모의 검사(Mac, AWS 호출 없음): `python3 -m unittest discover -s .github/scripts -p test_frontend_static_release.py`.

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

선잘알 봇 화면은 선택한 수신자로 BE 공개 `/recommendations/conversations` API를
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

추천 카드는 AI의 상품 ID·추천 이유·순서를 유지하고 기존 `GET /products/{productId}`로
최신 이름·가격·이미지·재고를 조회합니다. 같은 화면에서 동일 ID의 진행 중/완료 조회를
재사용하며 최종 Turn이 바뀌면 카드 순서와 이유도 최종 결과로 갱신합니다.
상품별 삭제·접근 불가·품절은 상품 보기를 막고, 일시 조회 오류에는 해당 상품만 재시도합니다.
상품 보기 직전에 판매 상태를 다시 확인하고 기존 상세 화면으로 이동합니다.
같은 탭에서 상세 화면을 새로고침해도 뒤로 가기로 대화·스크롤을 복원합니다.
입력 영역 높이가 바뀌면 대화 하단 여백도 조절하여 마지막 카드·버튼이 가려지지 않게 합니다.
상품 API에 카테고리가 없으므로 이미지 실패 시 일반 선물 이모티콘(🎁)을 사용합니다.

추가 조건은 같은 대화의 새 turnId로 전송하며 이전 추천을 유지합니다. 별도 다시 추천받기
기능·요청 규칙은 현재 FE·BE에 없으므로 버튼을 추가하지 않습니다. 추천 점수 정렬,
추가 질문 횟수 제한, 자동 재검색도 계약 없이 추가하지 않습니다.

기본 mock API에서는 `?chatMock=text`, `long`, `reconnect`, `slow`, `delayed_tokens`,
`failed`, `timeout`, `cards`로 흐름을 재현합니다. mock 기록은 테스트·미리보기용이며 실제 AI 결과가 아닙니다.
`cards`의 가상 상품 ID `900000001–900000003`은 실제 상품 API 조회·상세 이동을 막습니다.
상품 상세 이동 검증에는 별도 상품 API fixture를 사용하는 `tests/e2e/chat-products-api.spec.ts`를 사용합니다.
실제 연동은 기존 `VITE_USE_MOCK_API=false` 설정을 사용합니다.

채팅 검증은 `tests/chat-parser.spec.ts`, `tests/e2e/chat.spec.ts` 및 실제 API 모드의
`tests/e2e/chat-api.spec.ts`에 있습니다. API 모드 검증은
`npm run test:e2e:api-error -- tests/e2e/chat-api.spec.ts`로 실행합니다.
실제 BE·AI 서비스와의 연동 완료 여부는 mock 및 요청 가로채기 E2E와 별도로 검증해야 합니다.
