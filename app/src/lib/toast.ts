let globalAddToast: ((msg: { message: string; type: 'success' | 'error' | 'info' }) => void) | null = null;

export function setToastHandler(handler: typeof globalAddToast) {
  globalAddToast = handler;
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  globalAddToast?.({ message, type });
}
