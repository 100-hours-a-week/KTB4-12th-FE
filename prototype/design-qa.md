# Design QA — Sunjalal brand refresh

- source visual truth paths:
  - `/Users/Yihyun_1/Desktop/Codex 이미지 2026년 9월 16일 오후 01_03_29.png`
  - `/var/folders/g0/vpm_ztr16nqcjbp49vpr83kr0000gn/T/codex-clipboard-f54e2857-73b6-45be-905f-f8f024934ba0.png`
- implementation screenshot evidence: Codex in-app Browser tab 3, `http://127.0.0.1:4173/` (inline captures of login, friends, gifts, and my-page states)
- viewport: 1280 × 720 browser capture containing the unmodified iPhone preview; app screen rendered by the bundled mobile runtime
- source pixels: app icon 1254 × 1254 with alpha; brand board 1536 × 1024
- implementation density: browser default device scale; no density normalization was needed because the source is a brand direction board rather than a pixel-identical app screen
- state: signed-out login, signed-in friends list, gift catalog, and my page

## Full-view comparison evidence

- The reference palette is represented with coral `#ff6b6b`, blush `#ffd6d8`, warm white `#fff7f5`, and charcoal `#2d2d33` tokens.
- The supplied app icon is used as a real raster brand asset in the login lockup and favicon; no emoji, CSS drawing, or placeholder replaces it.
- Warm backgrounds, white bordered cards, soft coral selected states, and charcoal headings carry the reference tone across the main flows without changing their information structure.
- The login screen uses the supplied mark, Korean wordmark, Romanized name, and the reference message “선물을 더 쉽게, 마음을 더 가깝게.”

## Focused-region comparison evidence

- Bottom navigation was inspected in the friends, gifts, and my-page states. The previous mismatched home/profile treatment was replaced with one consistent Radix icon family: person, heart, and avatar.
- Active tabs use a restrained blush surface and coral foreground; inactive tabs use neutral gray. Labels remain visible, and all three controls retain their accessible names.
- Cards, fields, primary buttons, filter controls, switches, radio controls, and selection dots were checked as a shared component set rather than screen-specific one-offs.

## Required fidelity surfaces

- Fonts and typography: Korean text uses the system Korean sans stack with strong charcoal display weights and tighter heading tracking. The Romanized logo uses wider tracking to match the brand board.
- Spacing and layout rhythm: Existing Figma-derived screen geometry is preserved. The brand lockup, card borders, shadows, and tab selected surfaces add hierarchy without changing navigation or content density.
- Colors and visual tokens: Brand colors match the supplied board. Coral is reserved for primary actions and selected states; warm white and blush carry the friendly surface treatment.
- Image quality and asset fidelity: The supplied transparent app icon is copied directly to `/assets/brand/sunjalal-app-icon.png` and stays sharp at the displayed 70 × 70 CSS size. Existing product photography is preserved.
- Copy and content: Existing product copy remains unchanged except for the supplied brand message on login. No unrequested page or feature was added.

## Comparison history

### Pass 1

- Finding: no P0, P1, or P2 visual mismatch was found for the requested brand-direction update.
- Fixes applied before capture: introduced the supplied app icon, brand palette and lockup; unified cards and controls; replaced bottom-tab icons; visually checked four representative states.
- Post-fix evidence: in-app Browser captures show consistent coral/blush/charcoal styling and natural bottom-tab icons across friends, gifts, and my page.

## Interaction and quality checks

- Login with the local test account: passed
- Friends → Gifts → My-page tab navigation: passed
- Selected tab state and accessible labels: passed
- `npm run check:runtime`: passed
- `npm run build`: passed
- `npm run test:runtime`: 21 passed
- Standalone HTML export: passed

## Follow-up polish

- P3: A future typography pass could bundle a licensed rounded Korean display font if the team selects one; the current system stack avoids an unnecessary network dependency.

final result: passed
