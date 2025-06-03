<!-- src/components/ToastsContainer.svelte -->
<script lang="ts">
  import { toasts } from '$lib/toastStore'; // Adjust path if necessary
  import Toast from './Toast.svelte'; // Adjust path if necessary
  import { flip } from 'svelte/animate'; // For reordering animation

  // $: console.log('Active toasts:', $toasts); // For debugging
</script>

{#if $toasts && $toasts.length > 0}
  <div class="fixed bottom-0 right-0 p-4 md:p-6 space-y-3 z-[100]" aria-live="polite">
    {#each $toasts as toast (toast.id)}
      <div animate:flip={{ duration: 300 }}>
        <Toast {toast} />
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Ensure the container has a high z-index to appear above other content */
  .fixed {
    z-index: 100; /* Or higher if needed */
  }
</style>
