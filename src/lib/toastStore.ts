// src/lib/toastStore.ts
import { writable } from 'svelte/store';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const TOAST_DEFAULT_DURATION = 4000; // Default duration for a toast
const TOAST_ERROR_DURATION = 6000;   // Longer default for errors

export const toasts = writable<ToastMessage[]>([]);

export function addToast(
  message: string,
  type: ToastType = 'info',
  duration?: number
) {
  const id = crypto.randomUUID();

  let effectiveDuration = duration;
  if (effectiveDuration === undefined) {
    effectiveDuration = type === 'error' ? TOAST_ERROR_DURATION : TOAST_DEFAULT_DURATION;
  }

  toasts.update((allToasts) => {
    // Optional: limit number of toasts displayed at once
    // const updatedToasts = allToasts.length >= 5 ? allToasts.slice(1) : allToasts;
    // return [...updatedToasts, { id, message, type, duration: effectiveDuration }];
    return [...allToasts, { id, message, type, duration: effectiveDuration }];
  });
  return id;
}

export function removeToast(id: string) {
  toasts.update((allToasts) => {
    return allToasts.filter((toast) => toast.id !== id);
  });
}

export function clearAllToasts() {
    toasts.set([]);
}

// Convenience functions
export const toast = {
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration ?? TOAST_ERROR_DURATION),
    remove: removeToast,
    clear: clearAllToasts,
    addToast: (type: ToastType, message: string, duration?: number) => addToast(message, type, duration),
};
