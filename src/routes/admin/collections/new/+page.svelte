<!-- src/routes/admin/collections/new.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  // import { onMount } from 'svelte'; // Not strictly needed here

  let name = '';
  let errorMessage: string | null = null;
  let successMessage: string | null = null; // Will likely not be seen due to redirect
  let isSubmitting = false;

  async function handleSubmit() {
    if (!name.trim()) {
      errorMessage = 'Collection name cannot be empty.';
      // Clear success message if it was somehow set before validation fail
      successMessage = null;
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const result = await response.json(); // Attempt to parse JSON for both success and error

      if (!response.ok) {
        throw new Error(result.message || `Failed to create collection: ${response.status}`);
      }

      // successMessage = `Collection "${result.name}" created successfully! ID: ${result.id}`;
      // No need to set successMessage if redirecting immediately

      // Redirect to the new collection's page
      await goto(`/collections/${result.id}`, { replaceState: true }); // replaceState to avoid back button going to form

    } catch (err: any) {
      errorMessage = err.message;
      console.error('Error creating collection:', err);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create New Collection - My Flashcards</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-6 max-w-lg">
  <h1 class="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Create New Collection</h1>

  {#if errorMessage}
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
      <p class="font-bold">Error</p>
      <p>{errorMessage}</p>
    </div>
  {/if}
  {#if successMessage && !errorMessage}
    <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
      <p class="font-bold">Success</p>
      <p>{successMessage}</p>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit} class="space-y-6 bg-white p-6 md:p-8 rounded-lg shadow-xl">
    <div>
      <label for="collectionName" class="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
      <input
        type="text"
        id="collectionName"
        bind:value={name}
        required
        class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        placeholder="Enter collection name..."
        on:input={() => { if(errorMessage && name.trim()) errorMessage = null; }}
      />
    </div>

    <div class="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 mt-8">
      <a href="/" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Cancel
      </a>
      <button
        type="submit"
        disabled={isSubmitting || !name.trim()}
        class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        {isSubmitting ? 'Creating...' : 'Create Collection'}
      </button>
    </div>
  </form>
</div>
