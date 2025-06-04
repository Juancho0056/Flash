<!-- src/components/Toast.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import type { ToastMessage, ToastType } from '$lib/toastStore';
  import { removeToast } from '$lib/toastStore';

  export let toast: ToastMessage;

  let timerId: number | undefined = undefined;

  onMount(() => {
    if (toast.duration && toast.duration > 0) {
      timerId = window.setTimeout(() => {
        close();
      }, toast.duration);
    }
  });

  onDestroy(() => {
    clearTimeout(timerId);
  });

  function close() {
    // This will trigger the 'out' transition, then Svelte removes the component
    removeToast(toast.id);
  }

  const icons: Record<ToastType, string> = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.125 2.25h3.75M21 7.5H3M18.75 7.5v12.75c0 1.242-.99 2.25-2.219 2.25H7.469c-1.229 0-2.219-1.008-2.219-2.25V7.5m9 4.5v.75m-3-3.75l-.75.75m0 0l-.75-.75m.75.75v3.75m0-3.75h.75m-3.75 0h.75m1.5 0h.75M4.5 7.5v12.75c0 .828.672 1.5 1.5 1.5h9c.828 0 1.5-.672 1.5-1.5V7.5S18 4.5 12 4.5 4.5 7.5 4.5 7.5z" /></svg>`, // Changed error to a filled X-Circle or similar
  };

  const baseClasses = "flex items-start p-4 mb-3 text-sm rounded-lg shadow-xl w-full max-w-sm md:max-w-md";
  const typeClasses: Record<ToastType, string> = {
    info: "bg-blue-50 text-blue-700 dark:bg-gray-800 dark:text-blue-300 border border-blue-300 dark:border-blue-600",
    success: "bg-green-50 text-green-700 dark:bg-gray-800 dark:text-green-300 border border-green-300 dark:border-green-600",
    warning: "bg-yellow-50 text-yellow-700 dark:bg-gray-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-600",
    error: "bg-red-50 text-red-700 dark:bg-gray-800 dark:text-red-300 border border-red-300 dark:border-red-600",
  };

  const closeButtonBaseClasses = "ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 p-1.5 inline-flex items-center justify-center h-8 w-8";
  const closeButtonTypeClasses: Record<ToastType, string> = {
    info: "text-blue-500 hover:bg-blue-100 focus:ring-blue-400 dark:text-blue-300 dark:hover:bg-gray-700",
    success: "text-green-500 hover:bg-green-100 focus:ring-green-400 dark:text-green-300 dark:hover:bg-gray-700",
    warning: "text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-400 dark:text-yellow-300 dark:hover:bg-gray-700",
    error: "text-red-500 hover:bg-red-100 focus:ring-red-400 dark:text-red-300 dark:hover:bg-gray-700",
  };

</script>

<div
  class="{baseClasses} {typeClasses[toast.type]}"
  role="alert"
  in:fly={{ y: -20, duration: 300, opacity: 0}}
  out:fade={{ duration: 300 }}
  aria-live="assertive"
  aria-atomic="true"
>
  <div class="icon mr-3 shrink-0 pt-0.5"> <!-- pt-0.5 for slight alignment adjustment -->
    {@html icons[toast.type]}
  </div>
  <div class="message flex-grow mr-3 text-sm font-medium break-words">{toast.message}</div>
  <button
    type="button"
    class="{closeButtonBaseClasses} {closeButtonTypeClasses[toast.type]}"
    aria-label="Close"
    on:click={close}
  >
    <span class="sr-only">Close</span>
    <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
    </svg>
  </button>
</div>

<style>
  .icon :global(svg) {
    width: 1.25rem; /* w-5 */
    height: 1.25rem; /* h-5 */
  }
</style>
