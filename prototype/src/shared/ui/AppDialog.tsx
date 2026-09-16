import type { ReactNode } from 'react';

type AppDialogProps = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AppDialog({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: AppDialogProps) {
  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-copy">
          <h2 id="dialog-title">{title}</h2>
          <p>{body}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            취소
          </button>
          <button type="button" className={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
