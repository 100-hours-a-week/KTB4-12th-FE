import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';

type ToastProps = {
  message: string | null;
  container?: HTMLElement | null;
};

export function Toast({ message, container }: ToastProps) {
  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          className="app-toast"
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    container ?? document.body,
  );
}
