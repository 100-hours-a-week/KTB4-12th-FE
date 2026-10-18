# Mobile Prototype Agent Guide

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI with the FSD-style layers under `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, and `src/shared`; keep `src/Prototype.tsx` as the thin runtime entry point and shared visual rules in `src/prototype.css`. Follow `src/ARCHITECTURE.md` for layer responsibilities and import direction.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Desktop phone previews must render the complete simulated device chrome, including clock, battery/network indicators, and the iOS or Android navigation indicator. On phone-sized or coarse-pointer devices, render the app edge-to-edge and hide all preview-only chrome: the external bezel, device picker, camera cutout, simulated status bar, OS home/navigation indicator, and custom cursor. Keep the app's own bottom navigation in both environments.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Prototype Decisions

- 로그인·회원가입·약관 화면의 리포트 버튼은 일반 화면의 플로팅 버튼과 동일하게 오른쪽 16px, 하단 안전 영역 + 88px 위치에 둔다.

- 내 선물 취향은 BE `MAX_PREFERENCE_CODE_POINTS`와 동일하게 이모지 포함 Unicode code point 기준 최대 300자로 제한한다.

- Simulated keyboard disabled: `src/Prototype.tsx` calls `setSimulatedKeyboardEnabled(false)`, so focusing an input never opens the on-screen keyboard. Text entry still uses `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField`; native focus, blur dismissal, and safe-area insets stay intact. Keep this opt-out unless a phone-keyboard demo is explicitly requested.
- Phone-sized and coarse-pointer environments use a compact 24px app-page top inset when no `ScreenHeader` is present because preview-only status chrome is hidden there. Keep the larger desktop page inset for simulated device chrome.
- Product detail images display uncropped at their original aspect ratio. Keep the quantity controls and gift CTA as separate, non-sticky elements unless explicitly changed later.
- On phone-sized and coarse-pointer environments, direct `ScreenHeader` children of app pages stay fixed flush to the top while the page body scrolls beneath them. Desktop simulated-device headers remain non-sticky.
- The feedback widget (formerly bug-report only) supports three categories — 버그 / 제안 / 도움 — chosen via chips in a modal titled "의견 남기기"; the FAB icon is 💬. The screenshot attach toggle is shown only for 버그/제안; 도움 never sends a screenshot. Screen spec lives in `docs/report-categories.md`.
- V3 expands gift history to include sent/received detail screens. Received-gift detail now composes the gift detail API with the confirmed review API for active review lookup, creation, editing, and soft deletion. Sent-gift detail and product browse detail do not expose review actions. Password changes are still excluded.
- AI chat uses the public BE `/recommendations/conversations` APIs for creation/recovery, turn submission, fetch SSE, turn lookup and explicit cancellation. Store conversations in versioned, user-scoped sessionStorage snapshots; never call BE–AI internal endpoints. Input is limited to 100 Unicode code points. Screen navigation closes only the transport; only the stop button cancels generation. Mock chat scenarios use `chatMock=text|long|reconnect|slow|delayed_tokens|failed|timeout|cards`; production mode uses the existing API environment settings. Profile statuses (`NONE`, `PENDING`, `COMPLETED`, `FAILED`) appear only through the corresponding `ai-profile-*` QA query.
- Chat recommendation cards validate live product details and stock before opening the existing product screen; keep per-product failures separate from chat failures. Mock card IDs 900000001–900000003 must never reach product APIs. There is no dedicated regenerate contract/button; additional conditions use the existing composer and a new turn ID.
- Extract shared app code only after two real use sites exist: primitives belong in `shared/ui`, domain presentation in `entities/*/ui`, repeated user actions in `features`, and cross-screen route/history state in `app`. Keep slice imports on public `index.ts` entry points; do not add a base page, router, modal manager, or global state dependency.

- 기존 종 버튼·알림 목록·이전 미읽음 알림은 유지한다. 목록 조회·로그인·새로고침에서 가져온 과거 알림은 팝업으로 표시하지 않는다.
- 미읽음 개수는 로그인 세션 시작 시 최초 조회하고 SSE 새 알림·연결 복구 시 갱신한다. 화면 전환·창 포커스·탭 복귀·알림 목록 열기로 재조회하지 않으며, 읽음 처리 응답의 개수를 직접 반영한다.
- 로그인 중 SSE 새 알림은 화면 위에서 내려오는 팝업 형태의 앱 상단 배너로 표시한다. 배경 화면은 움직이지 않고, 알림 아이콘·앱 이름·제목·내용을 보여준다. 모션 감소 설정에서는 이동 애니메이션을 생략한다. 배너는 6초 후 닫히며, 클릭 시 읽음 처리 후 알림 목록과 동일한 화면 이동 규칙을 따른다.

## Interaction Rules

- `FRIEND_REQUEST_RECEIVED` 알림을 누르면 알림을 닫고 친구 화면의 '받은 요청' 탭으로 이동하며 최신 요청 목록을 조회한다.
- 받은 친구 요청은 수락/거절, 보낸 요청은 취소할 수 있다. 확인 모달을 거친 뒤 처리하고, 성공 시 요청 목록과 친구 목록을 갱신한다.
- 친구 목록의 '친구 삭제'는 확인 모달 후 `DELETE /friends/{friendId}`를 호출한다. 삭제 후 목록을 갱신하고 해당 친구가 선물 수신자로 선택되어 있으면 선택을 해제한다.

- The current scope includes sent-gift and received-gift lists and detail screens. Keep list cards interactive for navigation. Review actions are available only on eligible received-gift detail screens; backend eligibility remains authoritative.
- Signup follows `B-02 form → B-03 terms → account creation`. The form action is labeled "다음", its draft survives a round trip back from terms, and no account is created until the terms action labeled "동의하고 회원가입" runs. The terms screen contains required privacy and gift-history consents plus the optional review/rating AI-improvement consent; only the two required consents gate completion.
- On the signup terms screen, always display every required term before any optional term, regardless of the order returned by the API.

- Bottom sheets must overlay the current screen without translating or scrolling the background. Opening a sheet may animate only the overlay and sheet; preserve the background screen position until the sheet closes.

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

- 시각 디자인은 전체 리디자인 이전 스타일을 유지한다. 사용자 요청에 따라 색상·타이포그래피·카드·소개 문구를 새 디자인으로 바꾸지 않고, 기존 기능과 API 계약을 보존하면서 포커스·화면 전환·중복 요청 방지·터치 충돌 같은 UX만 개선한다.

- 친구 삭제는 카드의 우측 상단 더보기 메뉴 안에 둔다. 선물하기 아래에 삭제 버튼을 상시 노출하지 않으며, 메뉴 선택 후 기존 확인 모달을 거친다.

- 선물 탐색 상단에는 받는 사람 선택 영역을 상시 표시하지 않는다. AI 추천순을 선택한 상태에서 수신자가 없을 때만 상품 목록 대신 받는 사람 선택 안내를 표시한다. 안내 버튼으로 선택 시트를 열며, 취소하면 안내를 유지하고 수신자 없는 AI 조회는 보내지 않는다.

- 선물 탐색에서 선택된 수신자의 “이름님에게 줄 선물” 문구는 유지한다. 받는 사람 변경·선택 해제는 옆의 더보기 메뉴에 묶고, 두 버튼을 상품 목록 위에 상시 노출하지 않는다.

- 받은 선물 상세의 리뷰 영역은 기존 앱 색상을 유지하는 카드로 구성한다. 별점은 44px 터치 영역과 선택 설명을 제공하고, 후기의 선택 여부·글자 수·저장 버튼을 구분한다. 작성 완료 후 점수와 후기를 표시하며 수정·취소·삭제 및 조회 실패 재시도를 유지한다. 미작성 리뷰의 404 계약은 변경하지 않는다.

- 선물 상세는 보낸/받은 사람, 상품 이미지·이름·가격, 리뷰를 하나의 흰색 상세 패널 안에서 이어서 보여준다. 상품 이미지는 상품명 위에서 패널 너비에 맞춰 크게 표시하되 원본 비율을 유지하고 자르지 않으며, 정보·리뷰는 별도 카드 대신 얇은 구분선으로 나눈다. 보낸 선물 상세에는 리뷰를 추가하지 않는다.

- 받은 선물 목록·상세에서는 금액을 표시하지 않는다. 상세에는 수량을 유지하고 단일 가격·총 가격을 숨긴다. 보낸 선물 상세의 금액 표시는 유지한다.

- 상품 목록의 카드 디자인은 유지한다. 상품 상세는 큰 원본 비율 이미지·브랜드·상품명·금액·설명을 하나의 흰색 패널로 묶고, 수량 조절과 선물하기 버튼은 기존처럼 별도 비고정 요소로 유지한다.

- 사용자 요청에 따라 AI 채팅의 화면 이름은 “선잘알 봇”으로 표시하고, 제공된 캐릭터 원본 이미지를 진입 버튼·봇 프로필·수신자 선택 전 안내에 사용한다. 첫 화면은 코랄 색상 안내 카드로 구성하며 기존 SSE·수신자 선택·고정 헤더·저장 복원 흐름을 유지한다.
