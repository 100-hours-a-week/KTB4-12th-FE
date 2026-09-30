import { domToBlob } from 'modern-screenshot';

// Discord 무료 업로드 한도(8MB)보다 약간 낮게 잡는다.
const MAX_FILE_BYTES = 7.5 * 1024 * 1024;
const JPEG_SCALES = [1, 0.75, 0.5];
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

// 위젯 자신과 미리보기 전용 크롬(커스텀 커서, 홈 인디케이터/안드로이드 내비게이션 바)은
// 캡처에서 제외한다. 특히 홈 인디케이터 SVG는 foreignObject 캡처에서 검은 막대로 깨진다.
const EXCLUDED_SELECTOR =
  '[data-bug-report-widget], .mobile-cursor, .home-indicator-svg, .android-navigation-bar';

function isWidgetNode(node: Node): boolean {
  return node instanceof Element && Boolean(node.closest(EXCLUDED_SELECTOR));
}

async function compressImage(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  let smallest: Blob = source;
  try {
    for (const scale of JPEG_SCALES) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of JPEG_QUALITIES) {
        const jpeg = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (!jpeg) continue;
        if (jpeg.size < smallest.size) smallest = jpeg;
        if (jpeg.size <= MAX_FILE_BYTES) return jpeg;
      }
    }
  } finally {
    bitmap.close();
  }
  return smallest;
}

/**
 * 모달을 열기 "직전" 화면을 PNG Blob으로 캡처한다.
 * 위젯 자신(data-bug-report-widget)은 filter로 제외하고,
 * 용량이 크면 JPEG로 내려 해상도/품질을 단계적으로 줄인다.
 */
export async function captureScreen(target: HTMLElement): Promise<Blob | null> {
  try {
    // PhoneFrame이 창 크기에 맞춰 transform: scale()로 축소된 상태면
    // modern-screenshot이 캔버스 크기를 축소된 getBoundingClientRect 기준으로 잡아
    // 캡처가 잘린다. 캔버스 크기를 자연 레이아웃 크기(offsetWidth/Height)로 명시해 보정한다.
    const blob = await domToBlob(target, {
      width: target.offsetWidth,
      height: target.offsetHeight,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: '#ffffff',
      filter: (node) => !isWidgetNode(node),
      // modern-screenshot은 ::placeholder 스타일을 복사하지 않는데(TODO 상태),
      // input의 computed -webkit-text-fill-color(본문 검정)만 인라인으로 복사해서
      // placeholder가 실제 입력값처럼 진하게 렌더링된다. 클론에서 이 속성을 제거하면
      // placeholder는 브라우저 기본 회색으로 돌아간다.
      onCloneEachNode: (cloned) => {
        if (cloned instanceof HTMLInputElement || cloned instanceof HTMLTextAreaElement) {
          cloned.style.removeProperty('-webkit-text-fill-color');
        }
      },
    });
    if (!blob) return null;
    if (blob.size <= MAX_FILE_BYTES) return blob;
    return await compressImage(blob);
  } catch {
    return null;
  }
}
