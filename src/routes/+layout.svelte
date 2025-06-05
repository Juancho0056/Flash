<!-- src/routes/+layout.svelte -->
<script lang="ts">
	// Import global styles if not handled by app.html directly or via an app.css
	// For this project, global.css is in static and linked by app.html, so direct import here might be redundant
	// unless app.html's link is removed in favor of this.
	// import '../app.css'; // Example if you move global.css import here
	// import '../static/global.css'; // This path is incorrect from here.
	import '../app.css';
	import ToastsContainer from '$lib/components/ToastsContainer.svelte'; // Adjust path if necessary
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

  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';

  export let data: PageData; // Received from +layout.ts

  async function handleLogout() {
    // We use a form submission with progressive enhancement for logout
    // to ensure it works even if JS is disabled (though less likely for a SvelteKit app)
    // Or, more simply, a fetch call. For this example, let's use fetch directly.
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });

    if (response.ok) {
      // Option 1: Force a full reload to clear all state and re-run load functions
      // window.location.href = '/';
      // Option 2: Use goto, which is more SvelteKit-idiomatic for SPA-like navigation
      // After logout, event.locals.user will be null in hooks.server.ts
      // and +layout.ts will reflect this, updating the UI.
      await goto('/', { invalidateAll: true }); // invalidateAll ensures fresh data from load functions
    } else {
      alert('Logout failed. Please try again.');
    }
  }
</script>

<ToastsContainer />

<div class="main-content flex min-h-screen flex-col">
  <header class="bg-gray-800 text-white p-4 shadow-md">
    <nav class="container mx-auto flex justify-between items-center">
      <a href="/" class="text-xl font-semibold hover:text-gray-300">Flashcard App</a>
      <ul class="flex space-x-4">
        <li><a href="/" class="hover:text-gray-300">Home</a></li>
        {#if data.user}
          <li><span class="text-gray-400">Logged in as {data.user.email}</span></li>
          <li>
            <button
              on:click={handleLogout}
              class="hover:text-gray-300 underline"
            >
              Logout
            </button>
          </li>
        {:else}
          <li><a href="/auth/login" class="hover:text-gray-300">Login</a></li>
          <li><a href="/auth/register" class="hover:text-gray-300">Register</a></li>
        {/if}
         <li><a href="/history" class="hover:text-gray-300">History</a></li>
      </ul>
    </nav>
  </header>
	<main class="flex-grow container mx-auto p-4 md:p-8">
		<slot />
	</main>
	<footer class="bg-gray-100 text-center p-4 text-sm text-gray-600">
    © {new Date().getFullYear()} Flashcard App. All rights reserved.
  </footer>
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
