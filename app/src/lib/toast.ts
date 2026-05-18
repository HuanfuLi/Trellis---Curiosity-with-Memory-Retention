/**
 * Toast helper — Phase 49-03 extension.
 *
 * Backward-compatible 3rd-arg `options` (optional). All existing 1-arg / 2-arg
 * call sites compile unchanged. Optional `action` enables a trailing inline
 * button (Undo, Retry, etc.) that the Toast component renders on the same row.
 */

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
}

type ToastPayload = {
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
};

let globalAddToast: ((msg: ToastPayload) => void) | null = null;

export function setToastHandler(handler: typeof globalAddToast) {
  globalAddToast = handler;
}

export function toast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  options?: ToastOptions,
) {
  globalAddToast?.({ message, type, action: options?.action });
}
