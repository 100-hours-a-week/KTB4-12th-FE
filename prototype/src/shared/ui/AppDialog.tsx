import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';

import { useKeyboard } from '../../mobile';

type AppDialogProps = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AppDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = '취소',
  confirmDisabled,
  busy,
  danger,
  onCancel,
  onConfirm,
}: AppDialogProps) {
  const keyboard = useKeyboard();
  const dismissKeyboard = useEffectEvent(() => keyboard.hide());
  const titleId = useId();
  const bodyId = useId();
  const dialog = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dismissKeyboard();
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <motion.div
      className="dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.16 }}
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.section
        ref={dialog}
        className="app-dialog"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 10, scale: reducedMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.stopPropagation();
            onCancel();
          }
          if (event.key !== 'Tab') return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (!first) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus({ preventScroll: true });
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
          }
        }}
      >
        <div className="dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={bodyId}>{body}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger' : 'primary'}
            disabled={confirmDisabled || busy}
            onClick={onConfirm}
          >
            {busy ? '처리 중' : confirmLabel}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
