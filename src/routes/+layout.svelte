<!-- src/routes/+layout.svelte -->
<script lang="ts">
  // Import global styles if not handled by app.html directly or via an app.css
  // For this project, global.css is in static and linked by app.html, so direct import here might be redundant
  // unless app.html's link is removed in favor of this.
  // import '../app.css'; // Example if you move global.css import here
  // import '../static/global.css'; // This path is incorrect from here.

  import ToastsContainer from '$lib/components/ToastsContainer.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Example: if you want to clear toasts on every new page navigation (SPA-like)
  // import { page } from '$app/stores';
  // import { clearAllToasts } from '$lib/toastStore';
  // $: $page.url && clearAllToasts(); // This might be too aggressive

  // Ensure Tailwind styles from global.css (linked in app.html) are applied.
  // No specific JS needed here for that.

  // This onMount is just to show that JS runs in this layout.
  // onMount(() => {
  //   if (browser) {
  //     console.log('Root layout mounted on client');
  //   }
  // });
</script>

<ToastsContainer />

<div class="main-content min-h-screen flex flex-col">
  <!-- <header>Header content if any</header> -->
  <main class="flex-grow">
    <slot />
  </main>
  <!-- <footer>Footer content if any</footer> -->
</div>

<style>
  /* Styles specific to the layout, if any */
  /* .main-content {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  main {
    flex: 1;
  } */
</style>
